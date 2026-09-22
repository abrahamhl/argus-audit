import { useMemo, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import { stableJson, SEVERITY_LABELS } from '@argus-audit/core';
import { ConfidenceChip, CopyButton, SeverityChip, StateChip } from './Badges';

const MODES: { id: ReportMode; label: string; hint: string }[] = [
  { id: 'simple', label: 'Simple', hint: 'What matters and what to do next' },
  { id: 'engineer', label: 'Engineer', hint: 'Evidence, methodology and reproduction' },
  { id: 'client', label: 'Client', hint: 'Plain language, no jargon' },
];

export function ReportPanel({
  result,
  mode,
  onMode,
}: {
  result: AuditResult;
  mode: ReportMode;
  onMode: (mode: ReportMode) => void;
}): ReactNode {
  const markdown = result.reports[mode];
  const evidenceById = useMemo(
    () => new Map(result.evidence.map((record) => [record.evidenceId, record])),
    [result.evidence],
  );

  function download(): void {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `argus-audit-${mode}-${result.target.hostname}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="report" aria-label="Reports">
      <div className="report-head">
        <h2>Reports</h2>
        <div className="report-actions">
          <CopyButton text={markdown} label="Copy report" />
          <button type="button" className="btn btn-ghost btn-small" onClick={download}>
            Download .md
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Report mode">
        {MODES.map((candidate) => (
          <button
            key={candidate.id}
            role="tab"
            type="button"
            id={`tab-${candidate.id}`}
            aria-selected={mode === candidate.id}
            aria-controls={`panel-${candidate.id}`}
            className={`tab ${mode === candidate.id ? 'is-active' : ''}`}
            onClick={() => onMode(candidate.id)}
          >
            <span>{candidate.label}</span>
            <span className="tab-hint">{candidate.hint}</span>
          </button>
        ))}
      </div>

      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${mode}`}
        aria-labelledby={`tab-${mode}`}
        key={mode}
      >
        {mode === 'simple' ? <SimpleReport result={result} /> : null}
        {mode === 'engineer' ? <EngineerReport result={result} evidenceById={evidenceById} /> : null}
        {mode === 'client' ? <ClientReport result={result} /> : null}
      </div>

      <pre className="print-only" aria-hidden="true">
        {markdown}
      </pre>
    </section>
  );
}

function SimpleReport({ result }: { result: AuditResult }): ReactNode {
  const groups = [
    { label: SEVERITY_LABELS.critical, findings: result.findings.filter((f) => f.severity === 'critical') },
    { label: SEVERITY_LABELS.review, findings: result.findings.filter((f) => f.severity === 'review') },
    {
      label: SEVERITY_LABELS.informational,
      findings: result.findings.filter((f) => f.severity === 'informational'),
    },
  ];

  return (
    <div>
      <p className="headline">{result.summary.headline}</p>
      {result.findings.length === 0 ? (
        <p>Nothing in the checks we ran needs attention today.</p>
      ) : (
        groups
          .filter((group) => group.findings.length > 0)
          .map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              <ul className="simple-list">
                {group.findings.map((finding) => (
                  <li key={finding.findingId}>
                    <p>
                      <strong>{finding.title}</strong>
                    </p>
                    <p>{finding.clientExplanation}</p>
                    <p className="muted small">What to do: {finding.howToFix}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
      <section>
        <h3>What we did not check</h3>
        <ul className="muted small">
          {result.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EngineerReport({
  result,
  evidenceById,
}: {
  result: AuditResult;
  evidenceById: Map<string, AuditResult['evidence'][number]>;
}): ReactNode {
  return (
    <div>
      <dl className="kv">
        <div>
          <dt>Target</dt>
          <dd className="mono">{result.target.url}</dd>
        </div>
        <div>
          <dt>Audit id</dt>
          <dd className="mono">{result.auditId}</dd>
        </div>
        <div>
          <dt>Window (UTC)</dt>
          <dd className="mono small">
            {result.startedAt} → {result.finishedAt}
          </dd>
        </div>
        <div>
          <dt>Methodology</dt>
          <dd className="mono">{result.methodologyVersion}</dd>
        </div>
        <div>
          <dt>Evidence source</dt>
          <dd>{result.source === 'live' ? 'Live public observation' : 'Recorded demo fixture'}</dd>
        </div>
        <div>
          <dt>Checks executed</dt>
          <dd>
            {result.summary.checksRun} checks · {result.summary.evidenceCount} evidence records
          </dd>
        </div>
      </dl>

      {result.findings.map((finding) => (
        <article key={finding.findingId} className="engineer-finding">
          <h3 className="mono">{finding.findingId}</h3>
          <p>{finding.title}</p>
          <p className="chips">
            <SeverityChip severity={finding.severity} />
            <StateChip state={finding.state} />
            <ConfidenceChip confidence={finding.confidence} />
          </p>
          <dl className="kv">
            <div>
              <dt>Rule</dt>
              <dd className="mono">
                {finding.ruleId}@{finding.ruleVersion}
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{finding.category}</dd>
            </div>
          </dl>
          <p>{finding.summary}</p>
          <h4>Evidence</h4>
          <ul className="evidence-list">
            {finding.evidenceIds.map((evidenceId) => {
              const record = evidenceById.get(evidenceId);
              if (record === undefined) {
                return <li key={evidenceId}>MISSING: {evidenceId}</li>;
              }
              return (
                <li key={evidenceId}>
                  <p className="mono small">
                    {evidenceId} · {record.checkId} · <StateChip state={record.state} />
                  </p>
                  <details>
                    <summary>Raw data</summary>
                    <pre className="raw-json">{stableJson(record.data)}</pre>
                  </details>
                </li>
              );
            })}
          </ul>
          <h4>How to reproduce</h4>
          <ol>
            {finding.howToReproduce.map((step) => (
              <li key={step} className="mono small">
                {step}
              </li>
            ))}
          </ol>
          <h4>How to fix</h4>
          <p>{finding.howToFix}</p>
          {finding.standards.length > 0 ? (
            <>
              <h4>Standards</h4>
              <ul>
                {finding.standards.map((standard) => (
                  <li key={standard}>{standard}</li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      ))}

      <h3>Audit limitations</h3>
      <ul className="muted small">
        {result.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </div>
  );
}

function ClientReport({ result }: { result: AuditResult }): ReactNode {
  const { critical, review, informational, total } = result.summary.counts;
  const intro =
    total === 0
      ? 'We checked a defined set of public website basics. All of them looked the way we would expect, and nothing needed attention.'
      : critical > 0
        ? 'We could not complete the main visit to the website, so parts of the review are missing. A short manual check is the sensible next step; the technical report explains exactly what happened.'
        : review > 0
          ? `The website works, and we found ${review} item${review === 1 ? '' : 's'} worth a closer look and ${informational} minor observation${informational === 1 ? '' : 's'}. None of them are emergencies.`
          : `The website looks healthy in the checks we ran. We noted ${informational} small observation${informational === 1 ? '' : 's'} you may want to look at when convenient.`;

  const categories = Array.from(new Set(result.findings.map((finding) => finding.category)));

  return (
    <div>
      <p className="headline">{intro}</p>
      {categories.map((category) => (
        <section key={category}>
          <h3>{category.replace('-', ' ')}</h3>
          <ul className="simple-list">
            {result.findings
              .filter((finding) => finding.category === category)
              .map((finding) => (
                <li key={finding.findingId}>
                  <p>
                    <strong>{finding.title}</strong>
                  </p>
                  <p>{finding.clientExplanation}</p>
                  <p className="muted small">Suggested next step: {finding.howToFix}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="muted small">
        This is a passive review of the public surface of the website. It is not a security assessment, a
        penetration test, or a legal or compliance review. Every statement is backed by a recorded observation
        with a timestamp.
      </p>
    </div>
  );
}
