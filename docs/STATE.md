# STATE — argus-audit

Last updated: 2026-09-22 (consolidation session 1, branch `consolidation/argus-master-v1`)

## Canonical runtime

| Item | Value |
|---|---|
| Product | `abrahamhl/argus-audit` |
| Live URL | https://argus-audit.argus-lab.workers.dev/ |
| Canonical branch | `main` (baseline `ee38818`, PR #1 merged 2026-09-22T13:29Z) |
| Working branch | `consolidation/argus-master-v1` (ahead of main; **not merged**) |
| Live runtime | Version ID `f3544168-c7fa-4c03-b0e0-8aba2e8f0fdc`, methodology **0.2.0**, `mode:"live"`, `aiExplanations:false`, Turnstile site key empty |
| Live controls | DO abuse guard (5/min/IP + daily cap 500), origin policy, acknowledgement required, no source maps |
| Live headers (verified) | HSTS + CSP + XFO + XCTO + Referrer-Policy + Permissions-Policy present |
| Deployed from | `consolidation/argus-master-v1` @ `5cc30c7` (plus post-deploy doc commits) |

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
| Live UI browser check (Playwright, live audit of example.com) | 9 findings, trace raw JSON visible, **0 console errors** at 1440/375 px | 2026-09-22 |

## Current test counts (our repo)

- `@argus-audit/core`: 62 deterministic tests (fixture-backed, offline)
- `@argus-audit/worker`: 14 tests
- UI: not unit-tested; verified in real browser (Playwright) locally and against
  the live deployment, plus CI build

## Environment notes

- Windows host; Git may warn about LF→CRLF on first touch (`.gitattributes` added: `eol=lf`).
- Donor worktrees live in `%TEMP%\opencode\donors\` (disposable; recreate with the
  commands in `CONSOLIDATION_MATRIX.md`).
- Local donor `C:\Users\2fabr\portfolio-work\argus` remains untouched except
  `git fetch`; worktrees are detached and read-only by policy.
