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
| PR-01 production hardening | **DONE** (deployed `f3544168`) | README truth, origin policy, acknowledgement, DO abuse guard + daily cap, runtime Turnstile key, dist hygiene, smoke script |
| PR-02 operator console | **DONE** (deployed `b3f3317e`) | Routed surfaces `/`, `/audit`, `/lab`, `/method`, `/architecture`; truthful pipeline; labelled simulator |
| PR-03 donor ports (DNS/SPF/DMARC, security.txt, hashing, AI gate) | **DONE** (deployed `c7c75d67`, methodology 0.3.0) | DoH adapter + fixtures; email/CAA rules; RFC 9116 scanner; canonical evidence hash; AI claim validator |
| PR-04 saved audits + retest/proof | NEXT | D1 persistence for audit records + share links with expiry; comparison engine (RESOLVED/IMPROVED/UNCHANGED/REGRESSED/UNVERIFIED) over two stored audits; no accounts; rate-limited writes; do not fake proof |
| TLS adapter (Node/local) | OPEN | Certificate chain/expiry outside Workers; the Worker keeps `NOT_CHECKED` |
| Location/radius discovery (V0.2 mode) | OPEN | Provider adapter contract + MapLibre; only after pilot gates move |
| Billing (V1) | OPEN | Stripe Checkout after commercial signal exists; pricing stays out of the public repo |
| PostHog analytics | OPEN | Consent-aware, disabled by default |
| Live progress telemetry | OPEN | `onProgress` events in core + SSE route; until then the UI labels the pipeline as process visualization |
| i18n reports (ES/NL/EN) | OPEN | Only if pilot users require it; no prices/claims in templates |

## Done in this session (for the log)

- Phase 0 recon + donor test reproduction (178/178, 8/8).
- `docs/CONSOLIDATION_MATRIX.md`, `docs/STATE.md`, `docs/DECISIONS.md`, `docs/OPEN_LOOPS.md`.
