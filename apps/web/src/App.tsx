import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AuditResult, ReportMode } from '@argus-audit/core';
import { fetchHealth, requestAudit, type HealthInfo } from './api';
import { useRoute } from './router';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { AuditPage } from './pages/AuditPage';
import { LabPage } from './pages/LabPage';
import { MethodPage } from './pages/MethodPage';
import { ArchitecturePage } from './pages/ArchitecturePage';

type Phase = 'idle' | 'running' | 'done' | 'error';

const THEME_KEY = 'argus-audit-theme';
const REPO = 'https://github.com/abrahamhl/argus-audit';

export function App(): ReactNode {
  const [route, navigate] = useRoute();
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
      <TopBar
        route={route}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        mode={demo?.mode ?? null}
      />

      <main id="main">
        {route === '/' ? <HomePage demo={demo} onNavigate={navigate} /> : null}
        {route === '/audit' ? (
          <AuditPage
            demo={demo}
            phase={phase}
            target={target}
            result={result}
            error={error}
            selectedId={selectedId}
            mode={mode}
            onRun={run}
            onSelect={select}
            onMode={setMode}
            onReset={reset}
          />
        ) : null}
        {route === '/lab' ? <LabPage /> : null}
        {route === '/method' ? <MethodPage /> : null}
        {route === '/architecture' ? <ArchitecturePage /> : null}
      </main>

      <footer className="footer">
        <p>
          Argus Audit performs passive, low-impact checks of the public surface of a website you are authorised
          to audit. It is not a vulnerability scanner, not a penetration test, and not legal advice.
        </p>
        <p className="muted small">
          No accounts, no tracking, no advertising. Evidence first; AI optional and never the source of truth.
          {' · '}
          <a href={`${REPO}/blob/main/docs/THREAT_MODEL.md`}>Threat model</a>
          {' · '}
          <a href={`${REPO}/blob/main/docs/EVIDENCE_CONTRACT.md`}>Evidence contract</a>
          {' · '}
          <a href={REPO}>Source</a>
        </p>
      </footer>
    </div>
  );
}
