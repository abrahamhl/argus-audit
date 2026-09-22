import { useState, type FormEvent, type ReactNode } from 'react';
import type { HealthInfo } from '../api';
import { TurnstileWidget } from './TurnstileWidget';

interface IdleViewProps {
  demo: HealthInfo | null;
  onRun: (url: string, turnstileToken?: string) => void;
}

export function IdleView({ demo, onRun }: IdleViewProps): ReactNode {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (url.trim().length === 0) return;
    onRun(url.trim(), token ?? undefined);
  }

  return (
    <section className="idle">
      <div className="hero">
        <p className="eyebrow">Evidence-first website review</p>
        <h1>Understand the digital health of any business you are authorised to audit.</h1>
        <p className="lead">
          A passive, low-impact check of the public surface of one website. Every conclusion points back to raw
          evidence with a timestamp, and the same result is rendered for three audiences: simple, engineer and
          client.
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
            <button type="submit" className="btn btn-primary" disabled={url.trim().length === 0}>
              Run passive audit
            </button>
          </div>
          <p id="target-hint" className="muted small">
            Only websites you are authorised to audit. Checks are passive and public-surface only: no logins, no
            exploitation, no private areas.
          </p>
          {siteKey !== undefined && siteKey.length > 0 ? (
            <TurnstileWidget siteKey={siteKey} onToken={setToken} />
          ) : null}
        </form>
        {demo !== null && demo.mode === 'fixture' ? (
          <div className="demo-banner" role="status">
            <strong>Demo mode.</strong> Live scanning is disabled in this deployment. Try the recorded fixtures:
            <div className="chips">
              {demo.fixtures.map((fixture) => (
                <button
                  key={fixture.id}
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setUrl(fixture.target)}
                >
                  {fixture.target.replace('https://', '')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {demo === null ? (
          <p className="muted small">
            API not reachable. For the offline demo run <code>pnpm dev:worker:fixture</code> and{' '}
            <code>pnpm dev:web</code> in two terminals.
          </p>
        ) : null}
      </div>

      <div className="idle-grid">
        <details className="card" open>
          <summary>What this audit does</summary>
          <ul>
            <li>Visits the site root over HTTPS and plain HTTP from one vantage point.</li>
            <li>Records reachability, the redirect chain, transport indicators and common security headers.</li>
            <li>Looks for privacy, legal, terms, contact and accessibility page links, and checks the privacy link.</li>
            <li>Scans delivered HTML for consent-tool indicators and public technology signals.</li>
            <li>Checks a bounded sample of internal links for broken responses.</li>
          </ul>
        </details>
        <details className="card" open>
          <summary>What this audit never does</summary>
          <ul>
            <li>No brute forcing, credential testing, authentication bypass or exploit execution.</li>
            <li>No hidden-directory discovery, private APIs or destructive requests.</li>
            <li>No legal conclusion: privacy observations are indicators for human review.</li>
            <li>No AI in the evidence or rule path. AI, when enabled, may only rephrase.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
