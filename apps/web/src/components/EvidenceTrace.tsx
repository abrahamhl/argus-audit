import { useState, type ReactNode } from 'react';
import type { EvidenceRecord, Finding } from '@argus-audit/core';
import { stableJson } from '@argus-audit/core';
import { ConfidenceChip, CopyButton, SeverityChip, StateChip } from './Badges';

type StepId = 'finding' | 'rule' | 'observation' | 'raw';

const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: 'finding', label: 'Finding', hint: 'What was concluded' },
  { id: 'rule', label: 'Rule', hint: 'Which deterministic rule decided it' },
  { id: 'observation', label: 'Observation', hint: 'What was captured' },
  { id: 'raw', label: 'Raw evidence', hint: 'The recorded data itself' },
];

export function EvidenceTrace({
  finding,
  evidence,
}: {
  finding: Finding;
  evidence: EvidenceRecord[];
}): ReactNode {
  const [step, setStep] = useState<StepId>('finding');
  const [selectedId, setSelectedId] = useState<string>(evidence[0]?.evidenceId ?? '');

  const selected =
    evidence.find((record) => record.evidenceId === selectedId) ?? evidence[0] ?? null;

  return (
    <section className="trace" aria-label="Evidence trace">
      <div className="trace-head">
        <h3>Evidence trace</h3>
        <p className="muted small">
          How this conclusion was produced. Click each step to follow it back to the raw observation.
        </p>
      </div>

      <ol className="trace-rail">
        {STEPS.map((candidate, index) => (
          <li key={candidate.id}>
            <button
              type="button"
              className={`trace-step ${step === candidate.id ? 'is-active' : ''}`}
              aria-current={step === candidate.id ? 'step' : undefined}
              onClick={() => setStep(candidate.id)}
            >
              <span className="trace-step-index">{index + 1}</span>
              <span className="trace-step-label">{candidate.label}</span>
              <span className="trace-step-hint">{candidate.hint}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="trace-panel" key={step}>
        {step === 'finding' ? (
          <div>
            <h4>{finding.title}</h4>
            <p className="chips">
              <SeverityChip severity={finding.severity} />
              <StateChip state={finding.state} />
              <ConfidenceChip confidence={finding.confidence} />
            </p>
            <p>{finding.summary}</p>
          </div>
        ) : null}

        {step === 'rule' ? (
          <div>
            <h4 className="mono">
              {finding.ruleId}@{finding.ruleVersion}
            </h4>
            <dl className="kv">
              <div>
                <dt>Category</dt>
                <dd>{finding.category}</dd>
              </div>
              <div>
                <dt>Claim state</dt>
                <dd>
                  <StateChip state={finding.state} />
                </dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>
                  <ConfidenceChip confidence={finding.confidence} />
                </dd>
              </div>
            </dl>
            {finding.standards.length > 0 ? (
              <ul>
                {finding.standards.map((standard) => (
                  <li key={standard}>{standard}</li>
                ))}
              </ul>
            ) : null}
            <p className="muted small">
              Rules are pure functions evaluated over the recorded evidence. The same evidence always produces
              the same finding. AI is not part of this step.
            </p>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setStep('observation')}>
              Inspect the observations →
            </button>
          </div>
        ) : null}

        {step === 'observation' ? (
          <div>
            {evidence.length === 0 ? (
              <p>This finding references no evidence records. That is an internal inconsistency.</p>
            ) : (
              <ul className="observation-list">
                {evidence.map((record) => (
                  <li key={record.evidenceId}>
                    <button
                      type="button"
                      className={`observation ${record.evidenceId === selected?.evidenceId ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedId(record.evidenceId);
                        setStep('raw');
                      }}
                    >
                      <span className="mono small">{record.checkId}</span>
                      <span className="chips">
                        <StateChip state={record.state} />
                      </span>
                      <span className="observation-subject mono small">{record.subject}</span>
                      <span className="muted small">
                        {record.method} · {record.observedAt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 'raw' ? (
          <div>
            {selected === null ? (
              <p>No raw evidence to display.</p>
            ) : (
              <>
                <div className="raw-head">
                  <div>
                    <p className="mono small">{selected.evidenceId}</p>
                    <p className="muted small">
                      {selected.method} {selected.subject} · observed {selected.observedAt}
                    </p>
                  </div>
                  <CopyButton
                    text={stableJson({
                      evidenceId: selected.evidenceId,
                      checkId: selected.checkId,
                      state: selected.state,
                      subject: selected.subject,
                      method: selected.method,
                      observedAt: selected.observedAt,
                      data: selected.data,
                      provenance: selected.provenance,
                      limitations: selected.limitations,
                    })}
                    label="Copy JSON"
                  />
                </div>
                <pre className="raw-json">
                  {stableJson({
                    data: selected.data,
                    provenance: selected.provenance,
                    limitations: selected.limitations,
                  })}
                </pre>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
