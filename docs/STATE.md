# STATE — argus-audit

Last updated: 2026-09-22 (consolidation session 1, branch `consolidation/argus-master-v1`)

## Canonical runtime

| Item | Value |
|---|---|
| Product | `abrahamhl/argus-audit` |
| Live URL | https://argus-audit.argus-lab.workers.dev/ |
| Canonical branch | `main` (baseline `ee38818`, PR #1 merged 2026-09-22T13:29Z) |
| Working branch | `consolidation/argus-master-v1` |
| Live health (verified) | 200 · `mode:"live"` · `aiExplanations:false` · `methodology:"0.1.0"` |
| Live headers (verified) | HSTS + CSP + XFO + XCTO + Referrer-Policy + Permissions-Policy present |
| Deployed baseline SHA | `ee38818` (assumed deployed from merged main; owner deployed) |

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

## Current test counts (our repo)

- `@argus-audit/core`: 59 deterministic tests (fixture-backed, offline)
- `@argus-audit/worker`: 8 tests
- UI: not unit-tested; verified in real browser (Playwright) and CI build

## Environment notes

- Windows host; Git may warn about LF→CRLF on first touch (`.gitattributes` added: `eol=lf`).
- Donor worktrees live in `%TEMP%\opencode\donors\` (disposable; recreate with the
  commands in `CONSOLIDATION_MATRIX.md`).
- Local donor `C:\Users\2fabr\portfolio-work\argus` remains untouched except
  `git fetch`; worktrees are detached and read-only by policy.
