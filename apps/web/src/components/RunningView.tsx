import { useEffect, useState, type ReactNode } from 'react';

const CHECKS = [
  'Reachability over HTTPS and plain HTTP, with the redirect chain',
  'Transport indicators: HSTS, HTTP→HTTPS upgrade, certificate scope note',
  'Common security headers and cookie flags',
  'Privacy, legal, terms, contact and accessibility page links',
  'Consent-tool indicators in the delivered HTML',
  'A bounded sample of internal links',
  'Public technology and accessibility signals',
];

export function RunningView({ url }: { url: string }): ReactNode {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="running" aria-live="polite" aria-busy="true">
      <div className="running-card">
        <div className="spinner" aria-hidden="true" />
        <h2>
          Auditing <span className="mono">{url}</span>
        </h2>
        <p className="muted">
          Passive requests only. Typically under 30 seconds; some sites respond slowly. {elapsed}s elapsed.
        </p>
        <p className="muted small">This run performs the following checks in one pass:</p>
        <ul className="running-checks">
          {CHECKS.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
