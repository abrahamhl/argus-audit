# Product gates (XYZ)

Canonical gates live machine-readably in
[`config/product-gates.json`](../config/product-gates.json). This page explains
them. Gates are never edited to look better than the evidence.

## 1. PRODUCT TRUTH — status: OPEN

> **X:** The tool identifies reproducible public website findings.
> **Y:** Fixture tests + independently reproduced live pilot findings.
> **Z:** Deterministic scanners + evidence model.

Current evidence:

- 59 deterministic core tests + 8 worker tests, all fixture-backed and offline.
- End-to-end audits of three recorded fixtures with byte-identical repeat runs.
- Claims guard prevents legal/fear phrasing in every report.
- **Missing:** at least one live audit of an authorised target, reproduced by a
  second person following the ENGINEER report steps. Until that exists, the
  gate stays OPEN.

How to close it: run `LIVE_AUDIT_TARGET=https://<authorised-target> pnpm test:live`,
then have a colleague repeat the "How to reproduce" steps for the findings and
record the outcome in this file.

## 2. USER VALUE — status: OPEN

> **X:** A business owner understands what needs attention faster than with the
> raw technical output.
> **Y:** Measured baseline-vs-Argus task study.
> **Z:** Progressive SIMPLE → ENGINEER evidence design.

Current evidence:

- Three report layers implemented with progressive disclosure and a
  plain-language client explanation per finding.
- **Missing:** a task study with non-technical participants comparing
  time-to-understanding against raw output (for example `curl -I` text).

How to close it: run a small study (5+ participants), record
time-to-answer and comprehension for a fixed set of questions, and store the
aggregate numbers here. No cherry-picked anecdotes.

## 3. COMMERCIAL SIGNAL — status: BLOCKED

> **X:** Businesses request or pay for deeper analysis/remediation.
> **Y:** Real pilot/conversion data only.
> **Z:** Free snapshot → human-assisted paid audit.

Current evidence:

- V0 contains no billing, no accounts and no contact flow by design.
- **Gate begins BLOCKED.** It may only be unblocked with recorded real-world
  requests or payments, never with projections.

How to close it: after the pilot workflow exists (manual `mailto` or booking
flow is enough to start), record every real request and conversion with dates
and outcomes. Demand is measured, never invented.

---

## Rule for changing a gate

1. Add the new evidence with a date and a reproducible reference.
2. Update `config/product-gates.json` and this file in the same PR.
3. A gate can move backwards (for example if a reproduction fails).
