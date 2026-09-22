# Consolidation matrix — argus-audit as canonical ARGUS Audit

Date: 2026-09-22 · Branch: `consolidation/argus-master-v1` · Evidence-first: every
row states how it was verified, not what a commit message claimed.

## Canonical product

| Fact | Value |
|---|---|
| Product | `abrahamhl/argus-audit` (this repo) |
| Live URL | https://argus-audit.argus-lab.workers.dev/ |
| Live health | `GET /api/health` → 200 `{"ok":true,"mode":"live","aiExplanations":false,"methodology":"0.1.0"}` (2026-09-22T14:22Z) |
| Live root headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present (curl -sSI, same time) |
| Merged baseline | PR #1 merged → `main` @ `ee38818`, CI green on main |

## Donors — reproduced, not believed

| Donor | Checkout | Reproduction command | Result |
|---|---|---|---|
| `abrahamhl/argus` `agent/research-engineering-v1` | detached @ `48b554e` | `pnpm install --frozen-lockfile && pnpm build && pnpm test` | **178/178 tests pass**: collectors 8, core 166, ai 4. Running `pnpm test` **without** `pnpm build` yields **0 tests** (tests execute from `dist/`). `pnpm verify` on this branch prints `VERIFY está desactivado.` — the README instructions do not work as written. |
| `abrahamhl/web-exposure-scan` `main` | depth-1 clone @ `4f5a865` | `npm test` | **8/8 tests pass** |
| `abrahamhl/argus` `gh-pages` | detached @ `cf517be` (deploy of `48b554e`) | read-only audit | Static simulator build, no live network calls. Contains fabricated hashes (`e3b0c442…` reused for unrelated records), fake case study ("Example Business B.V.", €180.000/yr), unverified conversion/ROI figures, "AVG CONFORM" and "100% PROVEN" claims. |
| `abrahamhl/eye-of-argus` | not checked out | — | Separate product. Not inspected beyond confirming branches exist; **do not merge**. |

## Capability matrix

Verdicts: **KEEP** (already canonical) · **PORT** (reimplement under our
contracts) · **REDESIGN** (concept only, different implementation) · **RETIRE**
(do not carry forward).

| Capability | Source | Evidence | Production value | Workers portability | Legal/license | Verdict |
|---|---|---|---|---|---|---|
| HTTP reachability + redirect chain | argus `collectors/http.ts:9-119`; ours live | donor 1 offline test + header rules tests; ours 59 core tests | Core | Native `fetch`, manual redirects | Same owner; donor license ambiguous (ISC metadata vs "All rights reserved" README) | **KEEP** ours |
| Security headers | argus `rules.ts:98-331`; web-exposure `headers.js:5-100`; ours live | donor core tests; ours fixture tests | High | Pure logic | Same owner | **KEEP** ours; port value-adds: HSTS `max-age<180d` warning, `Server`/`X-Powered-By` version leak, suppress absence findings on 4xx/WAF-blocked root |
| Cookies | ours (flags summary); web-exposure `headers.js:89-100` | ours tests | High | Pure | Same owner | **KEEP** ours (no values stored) |
| TLS certificate inspection | argus `collectors/tls.ts` (not wired); web-exposure `checks/tls.js` (raw socket) | donor: offline-only tests, no rule consumes it | Medium (expiry/cipher) | **Not portable**: Workers cannot read peer cert / raw sockets | Same owner | **REDESIGN as adapter boundary**: worker keeps explicit `NOT_CHECKED`; optional Node/local adapter later, never faked |
| DNS (A/AAAA/NS/MX/TXT) | argus `collectors/dns.ts:26-70` | donors 8 collector tests + core DNS rule tests | High (email trust reachability) | No UDP DNS in Workers → **DNS-over-HTTPS adapter via fetch** | Same owner | **PORT** as DoH adapter with fixtures |
| SPF rules | argus `rules.ts:387-492` (missing + weak `~all`/`+all`) | 6 core tests | High for SME email trust | Pure logic | Same owner | **PORT** (our rule contract, our states/wording) |
| DMARC rules | argus `rules.ts:494-594` (missing + `p=none`) | 6 core tests | High | Pure logic | Same owner | **PORT** |
| CAA / MX-without-SPF | web-exposure `dns.js:36-104` | 8 unit tests cover scoring/auth/HTML, not DNS checks directly | Medium | Pure logic once records exist | MIT | **PORT** logic; write our own tests |
| Email collector (MTA-STS, DMARC tags) | argus `collectors/email.ts` | not wired, no independent tests | Low now | Pure | Same owner | **RETIRE** for now (revisit under monitoring) |
| security.txt | argus `collectors/security-txt.ts:28-149` (RFC 9116 parse, expiry) | collector tests only; **not wired**; catalog references a rule that does not exist | Medium | Fully portable (`fetch`) | Same owner | **PORT** properly: scanner + rule + tests |
| Evidence hashing / canonicalization | argus `crypto.ts:4-26`, `engine.ts:75-104`, `bundle.ts` | crypto + invariants tests | High (integrity story) | Pure TS + WebCrypto | Same owner | **PORT** (canonical snapshot hash per audit; we already hash bodies) |
| Evidence immutability (deepFreeze, redaction) | argus `engine.ts:15-43`, `rules.ts:43-92` | invariants tests | Medium | Pure | Same owner | **REDESIGN**: we return frozen-equivalent immutable JSON by construction; add tamper-evidence tests |
| Confidence model | argus `schema:1-6` (`VERIFIED/SUPPORTED/INFERRED/UNKNOWN/CONTRADICTED`) mostly dead (only VERIFIED/INFERRED emitted) | confidence tests exercise dead code | Medium | Pure | Same owner | **REDESIGN**: our 5 live states stay canonical; port the clamp rule "AI-assisted ⇒ never VERIFIED" (we already never let AI create findings) |
| Authorization / scope gate | argus `authorization.ts:165-267`, `policy-engine.ts` | 10 + 52 tests | High | Pure | Same owner | **PORT concept now** (explicit acknowledgement + scope record); full scope lifecycle later |
| SSRF policy engine | argus `policy-engine.ts:81-165` | 52 tests | High | Pure | Same owner | **KEEP** ours; donor tests already informed ours |
| Retest / proof | argus `retest.ts:12-94` + Ed25519 `crypto.ts:45-67` | 6 + 2 tests | High for V1 monitoring | Pure TS (WebCrypto Ed25519 not available in Workers? verify later; comparison logic is portable) | Same owner | **REDESIGN later** (own PR; do not fake proof) |
| AI claim gate | argus `analyst.ts:134-141` (only checks non-empty `evidenceIds`, never validates them) | 4 ai tests | Medium | Pure | Same owner | **PORT with redesign**: validate AI output against forbidden-claim phrases at runtime; keep AI out of evidence path |
| Reports SIMPLE/ENGINEER/CLIENT | ours | fixture e2e + claims guard | High | Native | Ours | **KEEP** |
| Multilingual reports NL/EN/ES | argus `report-generator.ts` (but hardcodes AUX contact + prices; "100% compliance" claims in `case-study.ts`) | 6 + 2 tests | Medium | Portable strings | Same owner | **RETIRE claims / REDESIGN i18n later** |
| Commercial opportunity mapping | argus `rules.ts:714-786`, `service-catalog.ts` (EUR prices, broken rule refs) | 3 mapping tests | High as internal concept | Pure | Prices must not enter this public repo | **REDESIGN**: unpriced remediation categories in code; any pricing stays private |
| Operator console UX | gh-pages simulator (visual patterns) + our React app | read-only audit | High (comprehension) | Web | Claims in donor **RETIRED** | **REDESIGN** PR-02: own implementation, truthful states only |
| Location discovery / map | `eye-of-argus` | — | Future | — | Separate product | **RETIRE for argus-audit** |

## Killed in this phase (claims and artifacts)

- All gh-pages/`apps/web` simulator content: fabricated SHA-256 evidence values,
  "100% PROVEN", ROI/conversion defaults, fake case study, certificate mock.
- `case-study.ts` quantitative claims ("100% compliance", "maximally increased").
- Hardcoded AUX Design contact/badge and EUR pricing in ported report logic.
- Any implication of GDPR/NIS2 certification or government endorsement.
- DNS "SOA/timeout 3000ms" and "4 passive collectors" claims in the donor
  simulator (not what the code does).

## Rule for ports

1. Reimplement against our `EvidenceRecord`/`Finding` contracts.
2. Fixture-backed tests before wiring live.
3. No claim without measured evidence; no price/promise in the public repo.
4. If Workers cannot do it truthfully → adapter boundary + `NOT_CHECKED`, never
   simulation.
