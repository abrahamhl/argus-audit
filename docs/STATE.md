# STATE — argus-audit

Last updated: 2026-09-22 (consolidation session 1, branch `consolidation/argus-master-v1`)

## Canonical runtime

| Item | Value |
|---|---|
| Product | `abrahamhl/argus-audit` |
| Live URL | https://argus-audit.argus-lab.workers.dev/ |
| Canonical branch | `main` (baseline `ee38818`, PR #1 merged 2026-09-22T13:29Z) |
| Working branch | `consolidation/argus-master-v1` (ahead of main; **not merged**) |
| Live runtime | Version ID `c7c75d67-8f1c-4cc1-930d-adcbcbef296a`, methodology **0.3.0**, `mode:"live"`, `aiExplanations:false`, Turnstile site key empty |
| Live controls | DO abuse guard (5/min/IP + daily cap 500), origin policy, acknowledgement required, no source maps, DoH DNS (≤6 queries/audit) |
| Live headers (verified) | HSTS + CSP + XFO + XCTO + Referrer-Policy + Permissions-Policy present |
| Deployed from | `consolidation/argus-master-v1` (PR-01 `5cc30c7`, PR-02 `4978efe`, PR-03 `d3d1b6a`) |

## Toolchain / access

| Item | Value |
|---|---|
| Node / pnpm | v22.22.2 / 11.9.0 |
| Wrangler | 4.136.2, authenticated as `2f.abraham@gmail.com` (account `a69615db8af24be4d36fa0ac0d80656b`) with workers write |
| Turnstile | **Not configured.** No widget created/verified this session (needs owner Cloudflare API token or dashboard). Runtime site-key support is being added so no rebuild is needed later. |
| Repo secrets | None committed; basic secret scan in CI |

## Verification ledger (what was actually executed)

| Check | Result | When |
|---|---|---|
| `pnpm verify` on `build/v0-evidence-audit` (typecheck+tests+web build+worker dry-run) | green (67 tests) | 2026-09-22 pre-merge |
| CI on PR #1 and merge commit `ee38818` | green | 2026-09-22 |
| Live `/api/health` + root headers | 200 + all headers | 2026-09-22T14:22Z |
| Donor `argus@48b554e` tests | **178/178 pass after `pnpm build`**; 0 without build; `pnpm verify` disabled | 2026-09-22 |
| Donor `web-exposure-scan@4f5a865` tests | 8/8 pass | 2026-09-22 |
| Donor gh-pages claims audit | fabricated claims catalogued, retired | 2026-09-22 |
| PR-01 `pnpm verify` (core 62, worker 14) | green | 2026-09-22 |
| PR-01 local DO + endpoints smoke (`wrangler dev`) | DO window shared across routes, ack 400, lab 200, methodology 6/15 | 2026-09-22 |
| PR-01 deploy + `pnpm smoke:live` | **9/9 pass** (v0.2.0, all headers, no maps) | 2026-09-22 |
| PR-02 local UI (5 rutas, 1440/375, Playwright) | 15 reglas, 13 findings lab, 1 audit, **0 console errors** | 2026-09-22 |
| PR-02 deploy + live UI (Playwright) | method 15 · arch ok · lab 13 · audit 9 (LIVE) · trace raw · **0 console errors** | 2026-09-22 |
| PR-03 `pnpm verify` (core 67, worker 14) | green | 2026-09-22 |
| PR-03 deploy + live DNS check (`example.com`) | SPF `-all` · DMARC `p=reject` · CAA missing · security.txt missing · 6 DNS evidences OBSERVED · **81 tests** | 2026-09-22 |
| PR-03 `pnpm smoke:live` | **9/9 pass** (v0.3.0, Version `c7c75d67`) | 2026-09-22 |

## Current test counts (our repo)

- `@argus-audit/core`: 67 deterministic tests (fixture-backed, offline)
- `@argus-audit/worker`: 14 tests
- UI: not unit-tested; verified in real browser (Playwright) locally and against
  the live deployment, plus CI build

## Session log (DONE / VERIFIED / FAILED / DECISION / NEXT)

### Slice 1 — PHASE 0 truth-before-code

- DONE: donor worktrees, reproduced tests, matrix + state/decisions/open loops.
- VERIFIED: argus 178/178 (after build), web-exposure-scan 8/8, gh-pages claims catalogued.
- FAILED: nothing; noted that donor `pnpm verify` is disabled and 0 tests run without build.
- DECISION: D01–D11 recorded in `docs/DECISIONS.md`.
- NEXT: PR-01 hardening.

### Slice 2 — PR-01 production hardening

- DONE: origin policy, acknowledgement, DO abuse guard + daily cap, runtime Turnstile key, evidence hash, WAF/4xx suppression, AI output validator, smoke script, CI dist hygiene, README truth.
- VERIFIED: 76 tests, local DO smoke, deploy `f3544168`, smoke 9/9, live UI.
- FAILED: first smoke run failed its own source-map check (SPA fallback returns 200 HTML); fixed to validate content, not status.
- DECISION: methodology 0.2.0; Turnstile activation left as owner action.
- NEXT: PR-02 console.

### Slice 3 — PR-02 operator console

- DONE: router + five surfaces, ProcessViz, labelled lab, runtime methodology page, architecture page, actual fixture body hashes.
- VERIFIED: local + live Playwright, 0 console errors; deploy `b3f3317e`.
- FAILED: none (rate limits surfaced correctly during repeated live checks).
- DECISION: FIX/VERIFY explicitly labelled "not implemented".
- NEXT: PR-03 donor ports.

### Slice 4 — PR-03 donor ports

- DONE: DoH DNS adapter + `dns.records` scanner, SPF/DMARC/CAA rules, security.txt scanner + rules, fixtures extended, worker wiring.
- VERIFIED: 81 tests; deploy `c7c75d67`; live `example.com` DNS evidence correct; smoke 9/9.
- FAILED: nothing in this slice (type/format errors fixed during development).
- DECISION: methodology 0.3.0; retest/proof deferred to the next PR with D1 persistence.
- NEXT: PR-04 (proposed): saved audits + share links (D1) + retest/proof comparison.

## Environment notes

- Windows host; Git may warn about LF→CRLF on first touch (`.gitattributes` added: `eol=lf`).
- Donor worktrees live in `%TEMP%\opencode\donors\` (disposable; recreate with the
  commands in `CONSOLIDATION_MATRIX.md`).
- Local donor `C:\Users\2fabr\portfolio-work\argus` remains untouched except
  `git fetch`; worktrees are detached and read-only by policy.
