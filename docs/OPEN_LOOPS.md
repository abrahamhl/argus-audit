# OPEN LOOPS — argus-audit

Last updated: 2026-09-22 (consolidation session 1)

Each loop is a closed cycle (phase in → phase out), not a calendar date.
Status: `OPEN` · `BLOCKED (external)` · `NEXT PR` · `DONE`.

## Blocked on owner action

| Loop | Status | Exact action |
|---|---|---|
| Turnstile activation | BLOCKED (external) | Owner creates a Turnstile widget for `argus-audit.argus-lab.workers.dev` (dashboard or API) and runs `wrangler secret put TURNSTILE_SECRET` from `apps/worker`; site key is then set as the `TURNSTILE_SITE_KEY` var and appears in `/api/health`. Code support ships in PR-01. |
| Donor license cleanup (`argus`) | BLOCKED (owner) | Add a `LICENSE` file to `abrahamhl/argus` consistent with intent (ISC metadata vs "All rights reserved" README). No external reuse of donor code before that. |
| Live pilot reproduction (PRODUCT TRUTH gate) | OPEN | Owner/human runs `LIVE_AUDIT_TARGET=https://<authorised> pnpm test:live`, then a second person follows one finding's "How to reproduce" steps and records the outcome in `docs/PRODUCT_GATES.md`. |
| User-value task study (USER VALUE gate) | OPEN | Small study: raw output vs SIMPLE report, time-to-understanding, ≥5 non-technical participants. |
| Legacy migration execution | OPEN | Recommendations in `docs/LEGACY_MIGRATION.md`; archive/delete only after owner approval. |

## Next PRs (ordered)

| Loop | Status | Scope (closed cycle) |
|---|---|---|
| PR-01 production hardening | NEXT (this branch) | README truth + live URL/SHA, origin policy, acknowledgement, DO abuse guard + daily cap, Turnstile runtime key, source-map/secret verification, threat-model update, live smoke script, deploy. |
| PR-02 operator console | NEXT | Routes `/`, `/audit`, `/lab`, `/method`, `/architecture`; truthful pipeline visualization; evidence trace preserved; reports preserved; mobile first. |
| PR-03a DNS/SPF/DMARC via DoH | NEXT | DoH adapter + fixtures, SPF/DMARC/CAA rules, tests, reports include email-trust section. |
| PR-03b security.txt | NEXT | RFC 9116 scanner + rule + fixtures. |
| PR-03c evidence canonical hash + AI output validator | NEXT | `evidenceHash` on AuditResult, ENGINEER report shows it; runtime forbidden-phrase validation of AI text with fallback. |
| Retest / proof | OPEN | Comparison engine (RESOLVED/IMPROVED/UNCHANGED/REGRESSED/UNVERIFIED) over stored audits; requires D1 share/save first. Do not fake proof. |
| Share links / saved audits (D1) | OPEN | Encrypted-at-rest report JSON with expiry; no accounts; rate-limited writes. |
| Location/radius discovery (V0.2) | OPEN | Provider adapter contract + MapLibre; only after PR-01/02/03 land and gates allow pilots. |
| Billing (V1) | OPEN | Stripe Checkout after commercial signal exists; pricing stays out of the public repo. |
| PostHog analytics | OPEN | Consent-aware, disabled by default; only after privacy review. |
| Live progress telemetry | OPEN | If `/audit` progress is desired beyond process visualization: add `onProgress` events in core + SSE route; until then the UI says "process visualization". |
| TLS adapter | OPEN | Node/local adapter outside Workers for certificate chain/expiry; never inside the Worker. |
| i18n reports (ES/NL/EN) | OPEN | Only if pilot users require it; no prices/claims in templates. |

## Done in this session (for the log)

- Phase 0 recon + donor test reproduction (178/178, 8/8).
- `docs/CONSOLIDATION_MATRIX.md`, `docs/STATE.md`, `docs/DECISIONS.md`, `docs/OPEN_LOOPS.md`.
