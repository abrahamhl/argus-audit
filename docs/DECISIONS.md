# DECISIONS — argus-audit consolidation

Append-only. One line per decision: date · id · decision · why · revisit trigger.

| Date | ID | Decision | Why | Revisit when |
|---|---|---|---|---|
| 2026-09-22 | D01 | `argus-audit` is the product; `argus` is an R&D donor; `web-exposure-scan` is a legacy donor; `eye-of-argus` is a separate product and will not be merged. | Owner instruction; prevents convergence of three different runtimes. | Never (owner-level). |
| 2026-09-22 | D02 | Port capabilities by **reimplementation against our contracts**, never by wholesale copy or branch merge. | Donor code has dead paths, fabricated demo data and different invariants; copying imports their technical debt. | Never. |
| 2026-09-22 | D03 | TLS certificate inspection stays **`NOT_CHECKED`** in the Worker, with an adapter boundary documented for a future Node/local collector. | Cloudflare Workers cannot read peer certificates or use raw sockets; faking it would violate evidence truth. | When a real adapter runs outside the Worker and is tested live. |
| 2026-09-22 | D04 | DNS/SPF/DMARC will be implemented over **DNS-over-HTTPS via `fetch`**, with fixture-backed tests. | Workers have no UDP DNS; DoH is passive, public and deterministic to test. | If Cloudflare adds native DNS bindings. |
| 2026-09-22 | D05 | No prices, ROI, guarantees or customer cases in this public repository. Opportunity mapping is **unpriced** in code; commercial details stay private. | Public/private boundary from the product spec; donor catalog mixes prices with broken rule references. | Never in public repo. |
| 2026-09-22 | D06 | Turnstile becomes **runtime-configurable** (site key via `/api/health`, secret via `wrangler secret`), not build-time. | Allows enabling without redeploying the frontend and keeps the secret server-side only. | If Turnstile is retired in favour of another control. |
| 2026-09-22 | D07 | Abuse controls: Durable Object sliding window per IP **plus** global daily audit cap, with in-memory fallback for local dev. | Per-isolate in-memory limits reset on eviction and do not bound total cost. DOs (SQLite backend) are free-plan compatible. | If DO limits change or usage justifies KV. |
| 2026-09-22 | D08 | AI explanations stay **off by default**; add a runtime validator that rejects AI output containing legal/fear phrases and falls back to deterministic text. | Donor "claim gate" only checked that evidence IDs were non-empty — not sufficient. | When a model with measured acceptance rates is evaluated. |
| 2026-09-22 | D09 | Donor license ambiguity (`package.json: ISC` vs README "All rights reserved", no LICENSE file in `argus`) is noted; porting is OK within owner's own projects, but no donor code is copied verbatim into this public repo until resolved. | Consistency and auditability. | Before any external extraction or relicensing. |
| 2026-09-22 | D10 | The gh-pages/`apps/web` simulator is retired as a source of truth: **visual patterns only** (pipeline HUD, numbered nav, dark console). No text, hashes, metrics or cases. | Read-only audit found fabricated hashes, fake case study and unverified compliance claims. | Never for content; visuals are already being redesigned in PR-02. |
| 2026-09-22 | D11 | Health and methodology metadata are exposed by the Worker (`/api/health`, `/api/methodology`) so `/method` and `/architecture` pages are generated from the same source as the scanners. | Single source of truth; avoids documentation drift. | If the API surface must shrink. |

## Open decision (needs owner when it matters)

- **Turnstile activation** requires the owner to create the widget (or provide an
  API token). Code support ships without it; rate limits and caps are active.
- **Donor license cleanup** in `argus` (add a LICENSE file consistent with
  intent) before any external reuse.
