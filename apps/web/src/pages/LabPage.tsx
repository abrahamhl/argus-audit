import { useEffect, useState, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import { fetchLabFixtures, requestLabAudit, type FixtureSummary } from '../api';
import { ProcessViz, type PipelinePhase } from '../components/ProcessViz';
import { ResultView } from '../components/ResultView';

export function LabPage(): ReactNode {
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>('simple');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLabFixtures().then((list) => {
      if (!cancelled) setFixtures(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(target: string): Promise<void> {
    setPhase('running');
    setError(null);
    setResult(null);
    try {
      const audit = await requestLabAudit(target);
      setResult(audit);
      setSelectedId(audit.findings[0]?.findingId ?? null);
      setMode('simple');
      setPhase('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lab run failed.');
      setPhase('error');
    }
  }

  function reset(): void {
    setPhase('idle');
    setResult(null);
    setError(null);
    setSelectedId(null);
  }

  return (
    <section className="page">
      <div className="lab-banner" role="note">
        <strong>SIMULATOR.</strong> Runs on this page replay recorded fixture bundles. No live website is
        contacted, and the reported timestamps are those of the recording — not of this run.
      </div>

      <div className="hero">
        <p className="eyebrow">Evidence lab</p>
        <h1>Replay recorded audits, inspect every stage.</h1>
        <p className="lead">
          Three fixtures cover a healthy site, a site with no security headers, and a neglected shop with mixed
          problems. The lab uses the same scanners, rules and reports as the live auditor.
        </p>
      </div>

      {fixtures.length > 0 ? (
        <div className="fixture-grid">
          {fixtures.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className="fixture-card"
              onClick={() => void run(fixture.target)}
              disabled={phase === 'running'}
            >
              <span className="mono">{fixture.target.replace('https://', '')}</span>
              <span className="fixture-name">{fixture.name}</span>
              <span className="muted small">recorded {fixture.recordedAt}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Fixture list is not reachable. Is the API running?</p>
      )}

      {phase === 'running' ? (
        <div className="running-card" aria-live="polite" aria-busy="true">
          <div className="spinner" aria-hidden="true" />
          <p className="muted">Replaying the recording…</p>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="error-card" role="alert">
          <h2>Lab run failed</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Reset
          </button>
        </div>
      ) : null}

      {phase === 'done' && result !== null ? (
        <>
          <ProcessViz phase="done" result={result} />
          <ResultView
            result={result}
            selectedId={selectedId}
            mode={mode}
            onSelect={setSelectedId}
            onMode={setMode}
            onReset={reset}
          />
        </>
      ) : null}
    </section>
  );
}
