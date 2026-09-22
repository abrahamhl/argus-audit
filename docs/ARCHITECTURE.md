# Architecture — Argus Audit V0

## Pipeline

```
                 ┌──────────────────────────────────────────────────┐
 target input ──►│ URL guard (fail-closed SSRF boundary)            │
                 └───────────────┬──────────────────────────────────┘
                                 ▼
        MemoTransport (one request per method+URL per audit)
        ┌───────────────┴────────────────┐
        │ LiveTransport (Workers fetch)  │  FixtureTransport (offline demo)
        └───────────────┬────────────────┘
                        ▼
        HttpClient: manual redirects, hop validation, timeout,
        request budget, body cap + sha-256
                        ▼
  scanners (fixed order): reachability → transport-security →
  security-headers → privacy-pages → broken-links → frontend-tech
                        ▼
              EvidenceRecord[] (states, provenance, limitations)
                        ▼
        deterministic rules (pure functions over EvidenceIndex)
                        ▼
                     Finding[]
                        ▼
   reports: SIMPLE / ENGINEER / CLIENT   +   optional AI rephrasing
```

## Packages

### `packages/core` (zero runtime dependencies)

| Area | Files |
|---|---|
| Contracts | `evidence.ts`, `finding.ts`, `contracts.ts`, `states.ts`, `version.ts`, `evidence-provenance.ts` |
| Boundary | `url-guard.ts` |
| Transport | `transport/types.ts`, `transport/live.ts`, `transport/fixture.ts`, `transport/client.ts` |
| Scanners | `scanners/*.ts` (6 scanners + shared homepage helper) |
| Rules | `rules/types.ts`, `rules/transport.ts`, `rules/headers.ts`, `rules/privacy.ts`, `rules/links.ts`, `rules/accessibility.ts`, `rules/index.ts` |
| Reports | `report/summary.ts`, `report/simple.ts`, `report/engineer.ts`, `report/client.ts` |
| Optional AI | `explain/types.ts` (contract + no-op template explainer) |
| Orchestration | `audit.ts` (`runAudit`) |
| Utilities | `util/clock.ts`, `util/hash.ts`, `util/html.ts`, `signatures.ts` |

The package is imported from source by both the Worker (bundled by Wrangler)
and the web app (type-only imports, erased at build time).

### `apps/worker`

- `src/index.ts` — router (`/api/health`, `/api/audit`), security headers,
  origin policy, body cap, rate limit, concurrency cap, Turnstile, fixture
  mode, structured errors.
- `src/rate-limit.ts` — sliding window per isolate (best effort, documented).
- `src/turnstile.ts` — optional siteverify with 5 s timeout.
- `src/fixtures.ts` — imports the three fixture bundles.
- `src/explain/workers-ai.ts` — optional explanation provider; the only place
  AI is allowed to touch the result, and only the `clientExplanation` field.
- `wrangler.jsonc` — single deployable Worker: API + static assets from
  `apps/web/dist`, `run_worker_first: ["/api/*"]`. D1/R2 bindings are commented
  placeholders for later versions.

### `apps/web`

React 19 + Vite 8, no router, no state library, one stylesheet.

- `App.tsx` — lifecycle (`idle → running → done | error`), theme, health probe.
- `components/IdleView.tsx` — landing, authorisation notice, demo targets.
- `components/RunningView.tsx` — truthful progress (elapsed time + checklist,
  no fake stage advancement).
- `components/ResultView.tsx` — summary, findings list, detail pane.
- `components/FindingDetail.tsx` — the six required sections.
- `components/EvidenceTrace.tsx` — **the wow feature**: Finding → Rule →
  Observation → Raw evidence, keyboard accessible, reduced-motion aware.
- `components/ReportPanel.tsx` — SIMPLE/ENGINEER/CLIENT tabs + copy/download/print.

## Runtime modes

| Mode | Transport | Network | Use |
|---|---|---|---|
| `AUDIT_MODE=live` | `LiveTransport` | yes, guarded | production |
| `AUDIT_MODE=fixture` | `FixtureTransport` | no | offline demo, Chromebook demos, tests |

## Determinism

- Fixed scanner order, fixed evidence ids, injected `Clock` and `auditId`.
- Fixture bundles replay exact responses; unknown URLs return a synthetic 404
  marked as fixture data so an audit can never silently reach the network.
- Tests assert byte-identical repeat runs.

## Deliberate non-choices

- No database in V0 (stateless audits); D1 arrives with saved audits (V0.4).
- No R2 until durable report artifacts are genuinely required (V1).
- No MapLibre/discovery yet (V0.2).
- No payments/accounts yet (V1).
- No framework beyond React/Vite; no CSS framework; no component library.
