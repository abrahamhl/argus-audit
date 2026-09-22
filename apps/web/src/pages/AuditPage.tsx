import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import type { HealthInfo } from '../api';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { ProcessViz, type PipelinePhase } from '../components/ProcessViz';
import { ResultView } from '../components/ResultView';

interface AuditPageProps {
  demo: HealthInfo | null;
  phase: PipelinePhase;
  target: string;
  result: AuditResult | null;
  error: string | null;
  selectedId: string | null;
  mode: ReportMode;
  onRun: (url: string, turnstileToken?: string) => void;
  onSelect: (findingId: string) => void;
  onMode: (mode: ReportMode) => void;
  onReset: () => void;
}

export function AuditPage(props: AuditPageProps): ReactNode {
  const { demo, phase, target, result, error, selectedId, mode } = props;
  const [url, setUrl] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const siteKey = demo?.turnstileSiteKey ?? undefined;

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (url.trim().length === 0 || !acknowledged) return;
    props.onRun(url.trim(), token ?? undefined);
  }

  if (phase === 'running') {
    return (
      <section className="page">
        <ProcessViz phase="running" result={null} />
        <Running target={target} />
      </section>
    );
  }

  if (phase === 'error') {
    return (
      <section className="page">
        <div className="error-card" role="alert">
          <h2>The audit could not be completed</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={props.onReset}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'done' && result !== null) {
    return (
      <section className="page">
        <ProcessViz phase="done" result={result} />
        <ResultView
          result={result}
          selectedId={selectedId}
          mode={mode}
          onSelect={props.onSelect}
          onMode={props.onMode}
          onReset={props.onReset}
        />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Live auditor</p>
        <h1>Run a passive audit on one website.</h1>
        <p className="lead">
          Only websites you are authorised to audit. The audit is a small set of ordinary public requests from
          one vantage point; nothing behind a login is touched and nothing is exploited.
        </p>
        <form className="audit-form" onSubmit={submit}>
          <label htmlFor="target-url">Public website address</label>
          <div className="audit-form-row">
            <input
              id="target-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="example.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-describedby="target-hint"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={url.trim().length === 0 || !acknowledged}
            >
              Run passive audit
            </button>
          </div>
          <label className="ack">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>I confirm I am authorised to audit this website.</span>
          </label>
          <p id="target-hint" className="muted small">
            Passive public-surface checks only: no logins, no exploitation, no private areas.
          </p>
          {siteKey !== undefined && siteKey.length > 0 ? (
            <TurnstileWidget siteKey={siteKey} onToken={setToken} />
          ) : null}
        </form>
        {demo !== null && demo.mode === 'fixture' ? (
          <p className="muted small">
            Demo deployment: live scanning is disabled. Use the <strong>Lab</strong> for recorded fixtures.
          </p>
        ) : null}
        {demo === null ? (
          <p className="muted small">
            API not reachable. For offline work run <code>pnpm dev:worker:fixture</code> and{' '}
            <code>pnpm dev:web</code> in two terminals.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Running({ target }: { target: string }): ReactNode {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="running-card" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <h2>
        Auditing <span className="mono">{target}</span>
      </h2>
      <p className="muted">
        Passive requests only. Typically under 30 seconds; some sites respond slowly. {elapsed}s elapsed.
      </p>
    </div>
  );
}
