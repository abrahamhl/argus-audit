# Legacy migration plan

Date: 2026-09-22 · Status: **recommendation only — nothing is archived or
deleted automatically.** Every action below needs the owner's explicit approval.

Canonical product after this consolidation: **`abrahamhl/argus-audit`**
(live: https://argus-audit.argus-lab.workers.dev/).

## 1. `abrahamhl/web-exposure-scan` — legacy donor

What it is: an MIT-licensed Node CLI + static page that performs one passive
HTTPS GET plus DNS/TLS checks and generates a priced report.

Evidence (reproduced): `npm test` → 8/8 tests. Unique logic worth keeping was
ported to argus-audit in PR-03 (WAF/4xx absence suppression, HSTS max-age
warning basis, CAA/SPF/DMARC indicators, Inconclusive-not-missing semantics).

Recommendation (owner decision):

1. Keep the repository public as a historical artifact.
2. Add a short notice at the top of its README:
   *"Legacy prototype. Active development has moved to
   `abrahamhl/argus-audit`. `index.html` findings are illustrative and not
   produced by live header checks."* — the web page currently appears to push
   header findings without fetching the target.
3. Do not delete. Do not archive silently.

Trigger to revisit: none planned.

## 2. `argus-bice.vercel.app` — legacy presentation

What it is: a Vercel deployment of the older ARGUS simulator/demo material.

Risk: it presents fabricated evidence hashes, a fictional case study
("Example Business B.V."), ROI/conversion figures and "AVG CONFORM"-style
claims that this consolidation explicitly retired.

Recommendation (owner decision):

1. **Retire or replace** the deployment: either take it down, or point it to
   the canonical product with a single honest line ("Legacy demo — current
   product: argus-audit.argus-lab.workers.dev").
2. Do not reuse any of its text, numbers or claims anywhere. The consolidation
   matrix records them as RETIRE.

## 3. `abrahamhl.github.io/argus` (gh-pages branch) — legacy simulator

What it is: the static build of commit `48b554e`'s simulator; same fabricated
content as the Vercel deployment.

Recommendation (owner decision):

1. Keep the branch for history; consider disabling GitHub Pages for it or
   replacing the published page with a pointer to the canonical product.
2. Do not feature it in profiles/portfolios as a product demo.

## 4. `abrahamhl/argus` — R&D donor

What it is: the offline-first evidence/opportunity control plane with 178
reproduced tests (after `pnpm build`). It is a research donor, **not** the
product.

Recommendation (owner decision):

1. Keep it as an R&D repository; do not merge it into argus-audit and do not
   copy branches.
2. Resolve the license inconsistency before any external reuse: the root
   `package.json` says ISC while the README says "All rights reserved" and no
   `LICENSE` file exists.
3. Consider a README status line: *"Research donor. The product built from
   these ideas is `abrahamhl/argus-audit`."*
4. `pnpm verify` is disabled on `agent/research-engineering-v1` — either
   re-enable or document that `pnpm build && pnpm test` is the reproduction
   path (tests run from `dist/`).

## 5. `abrahamhl/eye-of-argus` — separate product

Not touched, not merged, no migration. It remains a separate geospatial
evidence engine.

## What was migrated (for the record)

| Donor capability | Landed in argus-audit | Where |
|---|---|---|
| DNS / SPF / DMARC / CAA | PR-03 (reimplemented over DoH, fixtures + tests) | `packages/core/src/dns/*`, `scanners/dns.ts`, `rules/email.ts` |
| security.txt (RFC 9116) | PR-03 (collector was dead in donor; now wired with rules) | `scanners/security-txt.ts`, `rules/security.ts` |
| Evidence canonical hashing | PR-01 (`evidenceHash`, per-audit SHA-256) | `audit.ts`, ENGINEER report |
| AI claim/policy gate | PR-01 (runtime forbidden-claim validator; AI still off) | `claims.ts`, `audit.ts` |
| WAF/4xx absence suppression | PR-01 | `rules/types.ts` `responseUsable`, `scanners/shared.ts` |
| Scope acknowledgement | PR-01 (concept from authorization gate) | worker API contract + UI checkbox |
| Visual language (patterns only) | PR-02 (own implementation; no text/data reused) | `apps/web` |

Not migrated (kept in donor / planned): retest-proof engine, Ed25519 bundle
signing, multilingual report templates, MCP tooling, service catalog. See
`docs/OPEN_LOOPS.md` for the exact next PR.
