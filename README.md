# Argus Audit

[![CI](https://github.com/abrahamhl/argus-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/abrahamhl/argus-audit/actions/workflows/ci.yml)

**Evidence-first, passive website review for businesses you are authorised to audit.**

Argus Audit is a commercial-validation MVP and a sibling product of
[`eye-of-argus`](https://github.com/abrahamhl/eye-of-argus). It keeps the same
principles — *Evidence → Provenance → Freshness → Confidence → Finding → Report*
— applied to the public surface of a single website.

> **Status: V0 preview.** One website at a time. Passive checks only. No
> accounts, no billing, no location discovery yet. Not deployed as a commercial
> service. Every plan below is a PR-sized next step, not a promise.

---

## Golden path (V0)

1. Enter one public website address.
2. Argus performs **passive, low-impact public-surface checks** (no logins, no
   exploitation, no private areas).
3. Inspect findings with a full **Evidence Trace**:
   `Finding → Rule → Observation → Raw evidence`.
4. Read the same result as **SIMPLE**, **ENGINEER** or **CLIENT**.
5. Export as Markdown or print to PDF.

## What V0 checks (exhaustive list)

| Scanner | What it observes |
|---|---|
| `http.reachability` | HTTPS and plain-HTTP response, status, redirect chain |
| `tls.transport` | HSTS header, HTTP→HTTPS upgrade, HTTPS reachability. Certificate details are explicitly `NOT_CHECKED` (the runtime cannot see the peer certificate) |
| `headers.security` | CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options, cookie flag summary (no names, no values) |
| `privacy.pages` | Privacy / terms / legal / contact / accessibility link presence in delivered HTML; reachability of the privacy link; consent-tool name indicators |
| `links.broken` | Bounded sample (max 10) of internal links, HEAD then GET confirmation, rate-limit-aware |
| `frontend.tech` | Technology indicators from HTML/headers (all `INFERRED`); basic accessibility signals (lang, viewport, img alt) |

## What V0 deliberately does not do

- No brute forcing, credential testing, authentication bypass or exploit execution.
- No hidden-directory enumeration, no private APIs, no destructive requests.
- No TLS certificate inspection, no port scanning, no DNS enumeration.
- No AI in the evidence or rule path. AI (optional, off by default) may only
  rephrase an existing deterministic explanation.
- No legal conclusions. Privacy observations are labelled *indicator requiring
  review*, never *non-compliance*.

## Quick start

Requirements: Node.js ≥ 22 and pnpm 11 (`corepack enable`).

```bash
pnpm install --frozen-lockfile

# Deterministic tests (offline, fixture-backed)
pnpm -r test

# Typecheck all packages
pnpm -r typecheck

# Local development, two terminals:
pnpm dev:worker:fixture   # Worker + API on :8787 in DEMO mode (no network)
pnpm dev:web              # Vite UI on :5173 (proxies /api to :8787)

# Production-shaped build
pnpm build && pnpm --filter @argus-audit/worker dry-run
```

Open http://localhost:5173, press one of the demo targets and run the audit.
Demo mode is offline by design: it replays the three fixture bundles in
[`fixtures/`](fixtures/).

### Live mode locally

`pnpm dev:worker` (without `:fixture`) performs real network requests. The
scope guard rejects private/local/reserved hosts and validates every redirect.

## Architecture

```
scanner ──► EvidenceRecord ──► deterministic rule ──► Finding
(transport: live | fixture)      (pure functions)      │
                                                       ▼
                              reports: SIMPLE / ENGINEER / CLIENT
                                       ▲
                              optional AI rephrasing
                              (never the source of truth)
```

- **`packages/core`** — environment-agnostic engine: evidence contract, scanner
  contract, URL/SSRF guard, HTTP client with redirect control, six scanners,
  deterministic rules, three report renderers, optional explainer contract.
  Zero runtime dependencies. Runs identically in Node (tests) and Workers.
- **`apps/worker`** — Cloudflare Worker: `POST /api/audit`,
  `GET /api/health`, static-asset serving, security headers, best-effort rate
  limiting, optional Turnstile, optional Workers AI explainer, timeout handling.
- **`apps/web`** — React + Vite console (no router, no state library, no CSS
  framework): mobile-first, dark/light, keyboard accessible, Evidence Trace
  interaction, three report views, Markdown/print export.
- **`fixtures/`** — three recorded bundles used by tests, CI and demo mode.
- **`config/`** — machine-readable [infrastructure costs](config/infra-costs.json)
  and [product gates](config/product-gates.json).

### Evidence states (never collapsed)

`VERIFIED` · `OBSERVED` · `INFERRED` · `NOT_CHECKED` · `ERROR`

Absence of a header is an **observation** about one recorded response — not a
site-wide verdict. Technology matches are **inferences**. Certificate data is
**not checked** and says so. Failed requests are **errors**, never negative
findings. See [docs/EVIDENCE_CONTRACT.md](docs/EVIDENCE_CONTRACT.md).

## Tests

- `pnpm -r test` — deterministic, offline, fixture-backed:
  - `@argus-audit/core`: contract invariants, URL/SSRF guard, HTML extraction,
    transports and redirect handling, per-scanner expectations, end-to-end
    audits for the three fixtures, determinism (byte-identical repeat runs),
    claims guard (no legal/fear phrasing in any report), AI-failure fallback.
  - `@argus-audit/worker`: request parsing, rate limiter, fixture registry.
- **Live tests are separate and never run in CI**:
  `LIVE_AUDIT_TARGET=https://example.com pnpm test:live`.
- `pnpm verify` runs typecheck + tests + web build + Worker dry-run.

Exact counts live in the CI output; they are assertions, not badges.

## Security boundary

Default posture: **passive checks of third-party public surfaces only**.

- Fail-closed target guard (`packages/core/src/url-guard.ts`): rejects
  credentials, non-HTTP schemes, non-80/443 ports, single-label hostnames,
  loopback/private/link-local/reserved IPv4 and IPv6 literals, `.local`,
  `.internal`, `.onion` and cloud-metadata names. Every redirect hop is
  re-validated.
- Per-request timeout, total audit budget, redirect cap, request cap, response
  body cap (512 KB) and a bounded link sample.
- Worker responses carry CSP, `nosniff`, referrer and permissions policies;
  Turnstile is supported and optional; rate limiting is best-effort per isolate
  (documented limitation).
- Any future ACTIVE audit mode requires explicit authorisation and a separate
  scoped architecture. It is out of scope for V0 by design.

Full model: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) ·
Posture: [SECURITY.md](SECURITY.md).

## Deployment (Cloudflare Workers, free-first)

```bash
pnpm build                                       # web app
pnpm --filter @argus-audit/worker dry-run        # bundle validation
wrangler login                                   # once
pnpm --filter @argus-audit/worker deploy
```

Deployment status is **not claimed** by this repository. Before a public
deployment, verify the checklist in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md#pre-deployment-checklist):
tests green, no secrets in history, CSP and security headers, no provider
secrets in the client bundle, rate limits, error handling, deterministic
fixtures, report provenance, mobile layout, keyboard accessibility and a clean
clone reproduction.

Infrastructure cost assumptions live in
[`config/infra-costs.json`](config/infra-costs.json) (verified against provider
docs on 2026-09-22 where marked `documented`). **No cost claim is hard-coded
into marketing pages.** In V0 the application is expected to run within free
allowances.

## Product gates

[`config/product-gates.json`](config/product-gates.json) ·
[docs/PRODUCT_GATES.md](docs/PRODUCT_GATES.md)

- **PRODUCT TRUTH** — OPEN. Deterministic tests are green; a documented,
  independently reproduced live pilot finding is still required.
- **USER VALUE** — OPEN. Progressive SIMPLE → ENGINEER design exists; the
  baseline-vs-Argus task study has not been run.
- **COMMERCIAL SIGNAL** — **BLOCKED**. Real pilot data only. No invented demand.

## Known limitations (honest list)

- One network vantage point, one moment in time. Other locations or moments may
  observe different behaviour.
- Link and header observations cover the site root only, not every route.
- HTML link extraction is pattern-based; JavaScript-rendered navigation can be
  missed. This is recorded as a limitation on every affected evidence record.
- `Set-Cookie` values are never stored, but cookie *counts and flags* are.
- The consent-tool indicator is name-based and low-confidence by construction.
- Certificate chain, issuer and expiry are not inspected in V0.
- The in-memory rate limiter is per Worker isolate; it is best-effort, not a
  durable quota.
- DNS pinning is not possible in the Workers fetch runtime; a rebinding/TOCTOU
  window between guard and connect exists and is documented.
- Findings reflect only the implemented checks, not all possible weaknesses.
- Passing tests is not an independent security assessment.

## Repository boundary

This is the public repository. It deliberately contains **no** pricing or
fundraising strategy, private customer notes, competitor strategy or contact
flows. Those live in private working materials, exactly as with
`eye-of-argus`.

## License

No license has been selected yet. The workspace is `private` and publication is
disabled in package metadata. Do not reuse without asking.

## Roadmap (PR-sized, in order)

1. **V0.1** — hardening: durable rate limiting (Durable Object), optional DNS
   pinning mitigation, report share links via D1 with expiry.
2. **V0.2** — location/radius discovery behind a legitimate business-data
   adapter (MapLibre + provider adapter contract).
3. **V0.3** — batch passive audits with concurrency and rate limits.
4. **V0.4** — saved audits, comparison, share to client.
5. **V1** — paid report / monitoring pilot (Stripe Checkout), consent-aware
   PostHog.

Nothing above is implemented yet.
