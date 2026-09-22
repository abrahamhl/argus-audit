import type { ReactNode } from 'react';

const REPO = 'https://github.com/abrahamhl/argus-audit';

export function ArchitecturePage(): ReactNode {
  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Architecture</p>
        <h1>The runtime that produced your report.</h1>
        <p className="lead">
          One Cloudflare Worker serves the API and the static console. The engine is a dependency-free package
          that runs identically in Node (tests) and in the Worker (production).
        </p>
      </div>

      <section className="card">
        <h2>Pipeline</h2>
        <pre className="arch-diagram" aria-label="Pipeline diagram">{`TARGET → OBSERVE → PROVE → DECIDE → REPORT        (FIX → VERIFY: future)
           │          │         │          │
           │          │         │          └─ SIMPLE / ENGINEER / CLIENT
           │          │         └─ deterministic rules (pure functions)
           │          └─ evidence records + SHA-256 provenance + canonical hash
           └─ passive public requests (guarded fetch, memoised per audit)`}</pre>
        <p className="muted small">
          AI is optional, off by default, and may only replace the client-friendly sentence after passing a
          forbidden-claim check. It cannot create findings, severities or numbers.
        </p>
      </section>

      <div className="grid-cards">
        <article className="card">
          <h2>Trust boundaries</h2>
          <ul>
            <li>Fail-closed URL guard on the target and on every redirect hop (private/reserved ranges, metadata hosts, credentials, non-80/443 ports).</li>
            <li>Per-request timeout, audit-wide request and time budget, body-size cap, bounded link sample with delay.</li>
            <li>Durable Object abuse guard: per-IP sliding window plus global daily audit cap, persisted across deploys.</li>
            <li>Explicit origin policy and a mandatory scope acknowledgement per audit request.</li>
          </ul>
        </article>
        <article className="card">
          <h2>Adapter boundaries</h2>
          <ul>
            <li>
              <strong>TLS certificates:</strong> the Worker runtime cannot read peer certificates. The evidence
              says <span className="mono">NOT_CHECKED</span>; a Node/local adapter is the only truthful path.
            </li>
            <li>
              <strong>DNS / SPF / DMARC:</strong> no raw UDP DNS in Workers; a DNS-over-HTTPS adapter is the
              planned implementation (see the consolidation matrix).
            </li>
            <li>
              <strong>AI:</strong> Workers AI behind an adapter, disabled by default, output claim-checked.
            </li>
            <li>
              <strong>Retest / proof and saved audits:</strong> designed but not implemented; they will not be
              faked.
            </li>
          </ul>
        </article>
        <article className="card">
          <h2>Free-first runtime</h2>
          <ul>
            <li>Cloudflare Workers + static assets, Durable Object (SQLite backend), free allowances.</li>
            <li>Optional D1/R2 bindings are prepared but not wired; V0 stores nothing server-side.</li>
            <li>Cost registry: <span className="mono">config/infra-costs.json</span>, verified per provider.</li>
            <li>No analytics, no tracking, no external fonts.</li>
          </ul>
        </article>
        <article className="card">
          <h2>Read the source of truth</h2>
          <ul>
            <li>
              <a href={`${REPO}/blob/main/docs/EVIDENCE_CONTRACT.md`}>Evidence contract</a>
            </li>
            <li>
              <a href={`${REPO}/blob/main/docs/THREAT_MODEL.md`}>Threat model</a>
            </li>
            <li>
              <a href={`${REPO}/blob/main/docs/CONSOLIDATION_MATRIX.md`}>Consolidation matrix</a>
            </li>
            <li>
              <a href={`${REPO}/blob/main/docs/OPEN_LOOPS.md`}>Open loops</a>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
