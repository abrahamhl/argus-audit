import { useMemo, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import { SEVERITY_LABELS } from '@argus-audit/core';
import { FindingDetail } from './FindingDetail';
import { ReportPanel } from './ReportPanel';
import { StatesLegend } from './StatesLegend';
import { SeverityChip, StateChip } from './Badges';

interface ResultViewProps {
  result: AuditResult;
  selectedId: string | null;
  mode: ReportMode;
  onSelect: (findingId: string) => void;
  onMode: (mode: ReportMode) => void;
  onReset: () => void;
}

export function ResultView({
  result,
  selectedId,
  mode,
  onSelect,
  onMode,
  onReset,
}: ResultViewProps): ReactNode {
  const selected = useMemo(
    () => result.findings.find((finding) => finding.findingId === selectedId) ?? result.findings[0] ?? null,
    [result.findings, selectedId],
  );

  const selectedEvidence = useMemo(
    () => (selected === null ? [] : result.evidence.filter((record) => selected.evidenceIds.includes(record.evidenceId))),
    [result.evidence, selected],
  );

  return (
    <div className="result">
      <section className="summary" aria-label="Audit summary">
        <div className="summary-main">
          <p className="eyebrow">
            Audit complete · {result.source === 'live' ? 'LIVE observation' : 'DEMO fixture data'}
          </p>
          <h1 className="mono">{result.target.url}</h1>
          <p className="headline">{result.summary.headline}</p>
          <p className="muted small">
            Methodology {result.methodologyVersion} · audit id <span className="mono">{result.auditId}</span> ·{' '}
            {result.summary.checksRun} checks · {result.summary.evidenceCount} evidence records ·{' '}
            {freshnessLabel(result)}
          </p>
        </div>
        <div className="summary-side">
          <div className="stat-row">
            <Stat value={result.summary.counts.critical} label={SEVERITY_LABELS.critical} tone="critical" />
            <Stat value={result.summary.counts.review} label={SEVERITY_LABELS.review} tone="review" />
            <Stat
              value={result.summary.counts.informational}
              label={SEVERITY_LABELS.informational}
              tone="informational"
            />
          </div>
          <div className="state-counts">
            <StateChip state="OBSERVED" />
            <span className="muted small">
              {result.summary.evidenceStates.OBSERVED} observed · {result.summary.evidenceStates.INFERRED}{' '}
              inferred · {result.summary.evidenceStates.NOT_CHECKED} not checked ·{' '}
              {result.summary.evidenceStates.ERROR} error · {result.summary.evidenceStates.VERIFIED} verified
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onReset}>
            Audit another site
          </button>
        </div>
      </section>

      <div className="result-grid">
        <aside className="finding-list" aria-label="Findings">
          <h2>Findings</h2>
          {result.findings.length === 0 ? (
            <p className="muted">
              No rule produced a finding for this target. The reports below still list what was checked and what
              was not.
            </p>
          ) : (
            <ul>
              {result.findings.map((finding) => (
                <li key={finding.findingId}>
                  <button
                    type="button"
                    className={`finding-item ${selected?.findingId === finding.findingId ? 'is-selected' : ''}`}
                    aria-current={selected?.findingId === finding.findingId ? 'true' : undefined}
                    onClick={() => onSelect(finding.findingId)}
                  >
                    <SeverityChip severity={finding.severity} />
                    <span className="finding-item-title">{finding.title}</span>
                    <span className="finding-item-meta muted small">
                      <StateChip state={finding.state} /> {finding.confidence} confidence ·{' '}
                      {finding.evidenceIds.length} evidence reference
                      {finding.evidenceIds.length === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <StatesLegend />
        </aside>

        <div className="detail-column">
          {selected === null ? (
            <section className="card empty-state">
              <h2>No findings to inspect</h2>
              <p className="muted">
                The checks ran and produced no rule findings. The reports below explain what was checked.
              </p>
            </section>
          ) : (
            <FindingDetail finding={selected} evidence={selectedEvidence} />
          )}
        </div>
      </div>

      <ReportPanel result={result} mode={mode} onMode={onMode} />
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }): ReactNode {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function freshnessLabel(result: AuditResult): string {
  if (result.source === 'fixture') {
    return `demo data recorded ${result.freshness.fixtureRecordedAt ?? 'unknown'}`;
  }
  if (result.freshness.ageSeconds === null) return 'freshness unknown';
  if (result.freshness.ageSeconds < 90) return 'evidence captured just now';
  return `evidence captured ${Math.round(result.freshness.ageSeconds / 60)} minutes ago`;
}
