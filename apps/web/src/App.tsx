import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import { fetchHealth, requestAudit, type HealthInfo } from './api';
import { IdleView } from './components/IdleView';
import { RunningView } from './components/RunningView';
import { ResultView } from './components/ResultView';

type Phase = 'idle' | 'running' | 'done' | 'error';

const THEME_KEY = 'argus-audit-theme';

export function App(): ReactNode {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [demo, setDemo] = useState<HealthInfo | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>('simple');

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void fetchHealth().then((health) => {
      if (!cancelled) setDemo(health);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (url: string, turnstileToken?: string) => {
    setTarget(url);
    setPhase('running');
    setError(null);
    try {
      const audit = await requestAudit(url, turnstileToken);
      setResult(audit);
      setSelectedId(audit.findings[0]?.findingId ?? null);
      setMode('simple');
      setPhase('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The audit could not be completed.');
      setPhase('error');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setError(null);
    setSelectedId(null);
  }, []);

  const select = useCallback((findingId: string) => {
    setSelectedId(findingId);
    if (window.matchMedia('(max-width: 1040px)').matches) {
      window.requestAnimationFrame(() => {
        document.getElementById('finding-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            AA
          </span>
          <div>
            <p className="brand-name">ARGUS AUDIT</p>
            <p className="brand-tag">Evidence → Provenance → Finding → Report</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <main id="main">
        {phase === 'idle' ? <IdleView demo={demo} onRun={run} /> : null}
        {phase === 'running' ? <RunningView url={target} /> : null}
        {phase === 'error' ? (
          <section className="error-card" role="alert">
            <h2>The audit could not be completed</h2>
            <p>{error}</p>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Try again
            </button>
          </section>
        ) : null}
        {phase === 'done' && result !== null ? (
          <ResultView
            result={result}
            selectedId={selectedId}
            mode={mode}
            onSelect={select}
            onMode={setMode}
            onReset={reset}
          />
        ) : null}
      </main>

      <footer className="footer">
        <p>
          Argus Audit performs passive, low-impact checks of the public surface of a website you are authorised
          to audit. It is not a vulnerability scanner, not a penetration test, and not legal advice.
        </p>
        <p className="muted small">
          No accounts, no tracking pixels, no advertising. Evidence first; AI optional and never the source of
          truth.
        </p>
      </footer>
    </div>
  );
}
