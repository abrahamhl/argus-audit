import type { ReactNode } from 'react';
import type { HealthInfo } from '../api';
import { RouteLink, type Route } from '../router';
import { ProcessViz } from '../components/ProcessViz';
import { StatesLegend } from '../components/StatesLegend';

export function HomePage({
  demo,
  onNavigate,
}: {
  demo: HealthInfo | null;
  onNavigate: (route: Route) => void;
}): ReactNode {
  return (
    <section className="page home">
      <div className="hero">
        <p className="eyebrow">Evidence-first website review</p>
        <h1>Understand the digital health of any business you are authorised to audit.</h1>
        <p className="lead">
          Argus Audit performs passive, low-impact checks of the public surface of one website, records raw
          evidence with provenance, and renders the same result for three audiences: simple, engineer and client.
        </p>
        <div className="hero-cta">
          <RouteLink href="/audit" onNavigate={onNavigate} className="btn btn-primary">
            Run a passive audit
          </RouteLink>
          <RouteLink href="/lab" onNavigate={onNavigate} className="btn btn-ghost">
            Open the evidence lab
          </RouteLink>
        </div>
        <p className="muted small">
          {demo?.mode === 'fixture'
            ? 'This deployment is running in demo mode (recorded fixtures only).'
            : `Live runtime${demo !== null ? ` · methodology ${demo.methodology}` : ''} · AI explanations ${demo?.aiExplanations === true ? 'on' : 'off'}.`}
        </p>
      </div>

      <ProcessViz phase="idle" result={null} />

      <div className="grid-cards">
        <article className="card">
          <h2>What it checks</h2>
          <ul>
            <li>Reachability over HTTPS and plain HTTP, with the full redirect chain.</li>
            <li>Transport indicators: HSTS, HTTP→HTTPS upgrade (certificate details are explicitly not checked).</li>
            <li>Common security headers and cookie flag summaries (never cookie values).</li>
            <li>Privacy, legal, terms, contact and accessibility page links, and whether the privacy link works.</li>
            <li>Consent-tool indicators in delivered HTML.</li>
            <li>A bounded sample of internal links, plus public technology and accessibility signals.</li>
          </ul>
        </article>
        <article className="card">
          <h2>What it never does</h2>
          <ul>
            <li>No brute forcing, credential testing, authentication bypass or exploit execution.</li>
            <li>No hidden-directory discovery, private APIs or destructive requests.</li>
            <li>No legal conclusion: privacy observations are indicators for human review.</li>
            <li>No AI in the evidence or rule path; AI may only rephrase, and its output is claim-checked.</li>
          </ul>
        </article>
        <article className="card">
          <h2>Evidence you can follow</h2>
          <p>
            Every finding traces Finding → Rule → Observation → Raw evidence. Each audit issues a canonical
            SHA-256 hash over its evidence set, and every report states what was checked and what was not.
          </p>
          <StatesLegend />
        </article>
        <article className="card">
          <h2>Honest status</h2>
          <ul>
            <li>
              <strong>PRODUCT TRUTH — open.</strong> Fixture tests are green; a reproduced live pilot finding is
              still required.
            </li>
            <li>
              <strong>USER VALUE — open.</strong> The three-layer report design exists; the baseline task study
              has not been run.
            </li>
            <li>
              <strong>COMMERCIAL SIGNAL — blocked.</strong> Real pilot data only. No invented demand, no prices
              on this site.
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
