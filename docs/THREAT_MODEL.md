# Threat model — Argus Audit V0

Date: 2026-09-22 · Scope: V0 (single-domain passive audit), Worker + web + core.

## 1. Assets

| Asset | Why it matters |
|---|---|
| The scanned third-party website | Must receive only ordinary, low-impact public requests |
| Evidence integrity | A finding must be traceable to the exact observation |
| Operator secrets (Turnstile secret, future AI/payment keys) | Must never reach the browser or the repository |
| The product deployment | Must not become an SSRF proxy or a DDoS amplifier |
| Scanned-business perception | The product must never publish alarming or false claims |

## 2. Actors

- **Operator** — runs audits on domains they are authorised to audit.
- **End user** — reads reports; may be non-technical.
- **Third-party target** — any public website; may serve hostile content.
- **Abuser** — wants to point the scanner at arbitrary hosts or exhaust it.
- **Future AI provider** — untrusted for correctness; output is never evidence.

## 3. Trust boundaries

```
browser ──(same-origin /api)──► Worker ──(validated fetch)──► target website
   │                              │
   │                              ├─► fixtures (demo mode, no network)
   │                              ├─► Turnstile siteverify (optional)
   │                              └─► Workers AI (optional, output ≠ evidence)
```

1. Browser → Worker: untrusted input (`url`, optional token). Validated and
   size-capped.
2. Worker → target: every request passes the URL guard; every redirect hop is
   re-validated.
3. Worker → AI: only deterministic finding text is sent; the response may only
   replace the client-facing rephrasing and failure falls back to templates.
4. Scanned HTML is data, never code: it is parsed with regular expressions and
   never rendered as HTML in the UI (React escapes all text).

## 4. Threats and mitigations

| # | Threat | Mitigation | Residual risk |
|---|---|---|---|
| T1 | SSRF: scan internal services via direct target | `url-guard.ts`: schemes, ports, credentials, hostname/IP denylists (v4+v6, mapped), denied suffixes | DNS rebinding/TOCTOU not solvable in Workers fetch; documented |
| T2 | SSRF via redirect to private space | `HttpClient` validates every redirect hop with the same guard; blocks with `REDIRECT_BLOCKED` | Redirects to a public host that later resolves privately |
| T3 | Scanner becomes a DDoS reflector | Sequential requests, per-request delay, sample cap (10), 40-request/45-second audit budget, 512 KB body cap | Coordinated abuse via many IPs |
| T4 | API abuse / cost exhaustion | Durable Object sliding window (5/min/IP) + global daily audit cap (default 500) that survives isolate eviction; concurrency cap (4); optional Turnstile; body-size cap | Distributed abuse below per-IP thresholds still limited by the daily cap |
| T5 | Secret leakage to browser | Provider secrets are Worker bindings only; the client bundle contains no provider keys; `_headers` CSP restricts sources; CI rejects source maps and greps the bundle for secret-like strings | Operator misconfiguration |
| T6 | Prompt injection into AI explainer | AI receives structured JSON of deterministic text only; output is **validated against a forbidden-claim phrase list** — violations are rejected and deterministic text stands; AI cannot create findings, severities, evidence or numbers | Subtle rephrasing distortion; AI remains off by default |
| T7 | XSS via scanned content | No scanned HTML is rendered; only extracted text; React escapes; CSP `script-src 'self'` | Very low |
| T8 | Report tampering | Every finding references evidence ids; evidence carries provenance, sha-256 of bodies where captured, `recordedAt` for fixtures; **`evidenceHash` (SHA-256 over canonical evidence JSON) is issued per audit and shown in the ENGINEER report**; audits are deterministic for identical inputs | Hash is not signed; Ed25519-style signing could be ported later |
| T9 | False legal claims | Wording rules + machine-enforced claims guard test over all reports; privacy findings are labelled indicators; AI output validator at runtime | Human review still required |
| T10 | Hostile/huge responses | Timeout (10 s), body cap + truncation flag, content-type checks, no rendering; **4xx/WAF challenge roots never produce absence findings** (blocked state) | Slow sites lengthen audits (bounded by budget) |
| T11 | Data minimisation failures | No cookie values, no full HTML stored in reports; evidence keeps hashes and excerpts; no analytics in V0 | Operators should still treat scan targets as third-party data |
| T12 | Supply chain | Zero runtime dependencies in core; pinned lockfile; only TypeScript/Vite/React/Wrangler/Vitest as dev/UI deps; pnpm build-script allowlist | Standard npm ecosystem risk |
| T13 | Cross-origin API abuse from a browser | Explicit origin policy: same-host origin or configured `ALLOWED_ORIGIN`; otherwise 403 | Direct non-browser clients still allowed by design (they get no CORS benefit anyway) |
| T14 | Unauthorised scanning misuse | Mandatory `acknowledged: true` scope acknowledgement in the API contract and an explicit UI checkbox; audit trail includes timestamps and target in every report | Acknowledgement does not verify authorisation; the operator remains responsible |
| T15 | Third-party DNS resolver dependency | DNS-over-HTTPS with a 5 s timeout per query, ≤6 queries per audit; fixture resolver offline in CI; SERVFAIL/NXDOMAIN never converted into absence claims except where the status itself is the observation (NXDOMAIN on `_dmarc`), and `NXDOMAIN`/`SERVFAIL`/`ERROR` are recorded as evidence states, not findings | Resolver outages yield `ERROR` evidence and no email findings — explicit, never guessed |
| T16 | security.txt contact harvesting | The scanner stores only field **counts** and the expiry — Contact/Policy values are parsed but not written into evidence | Report readers can re-fetch the public file themselves |

## 5. Explicitly out of scope for V0 (by design)

- Active vulnerability testing of any kind (injection, auth bypass, exploitation).
- Credential testing, brute forcing, directory discovery.
- Vulnerability databases / CVE matching.
- Scanning targets the operator is not authorised to audit; the product cannot
  technically verify authorisation — it relies on the operator and the audit
  trail.
- Legal compliance determination.
- Any processing of data behind authentication.

Any future ACTIVE mode requires explicit written authorisation, a separate
scoped architecture and its own threat model. It will not be added to this
codebase as a flag.

## 6. Pre-deployment checklist

Run before any public deployment. Status of the first live deployment
(2026-09-22, baseline `ee38818`) is recorded per item.

- [x] Deterministic tests green (`pnpm -r test`)
- [x] Typecheck green (`pnpm -r typecheck`)
- [x] Web production build green (`pnpm build`)
- [x] Worker bundle dry-run green (`wrangler deploy --dry-run`)
- [x] Offline demo end-to-end (worker fixture mode + `/api/audit` returns reports)
- [x] No secrets, tokens or `.dev.vars` committed; `.gitignore` covers them; CI secret scan
- [x] CSP + security headers defined for static assets (`apps/web/public/_headers`) and API responses; live headers verified with `curl -sSI`
- [x] No provider secret is referenced through any `VITE_*` variable
- [x] Rate limiting + concurrency cap + request budget present
- [x] Durable abuse guard (DO) + global daily audit cap deployed
- [x] Origin policy enforced (same-host or explicit development origin)
- [x] Scope acknowledgement required by the API contract and the UI
- [x] No source maps built or served; CI dist hygiene check
- [x] Error/timeout handling returns structured errors without stack traces
- [x] Fixtures deterministic and byte-identical on repeat runs
- [x] Report provenance: every finding → evidence ids → raw data + canonical `evidenceHash`
- [x] Mobile layout and keyboard accessibility verified in a real browser (375 px / 1440 px, 0 console errors)
- [x] Clean-clone reproduction by CI on every push
- [x] Post-deploy smoke verification (`pnpm smoke:live`, also a manual workflow)
- [ ] Turnstile activation — code support + runtime site key are live; widget creation and `TURNSTILE_SECRET` are owner actions (see `docs/OPEN_LOOPS.md`)
- [ ] Owner re-run of the acceptance flow on the deployed build after each release

## 7. Privacy of scanned third parties

- Requests identify the scanner honestly (`User-Agent: ArgusAudit/0.1`).
- No personal data is extracted from scanned sites.
- Cookie names and values are never stored; only flags and counts.
- Evidence is returned to the requester; V0 stores nothing server-side.
