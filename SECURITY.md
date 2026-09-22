# Security policy

## Scope

Argus Audit performs **passive, low-impact checks of public website surfaces**.
It is not a vulnerability scanner and must not be used against systems you are
not authorised to audit. The full boundary is in
[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Reporting a vulnerability

Open a private security advisory on this repository
(GitHub → Security → Advisories) or contact the maintainer directly. Do not
open a public issue for exploitable problems. You will get an acknowledgement as
soon as possible; this is a small project, so please be patient.

Please include:

- affected component (`packages/core`, `apps/worker`, `apps/web`),
- reproduction steps,
- expected vs observed behaviour,
- impact assessment.

## In-scope examples

- SSRF guard bypasses (target validation or redirect validation).
- Prompt-injection paths that let AI create or alter findings/severities.
- Secret exposure in the client bundle or repository.
- Report-integrity violations (finding pointing to non-existent evidence).
- Rate-limit or budget bypasses with real impact.

## Out of scope

- Findings about the scanned third-party sites themselves.
- Missing features that are documented as V0 limitations.
- Denial of service requiring large-scale resource consumption of the free
  deployment.
- Social engineering of the maintainer.

## Handling secrets

- Provider secrets are Worker bindings only, never committed, never `VITE_*`.
- `.dev.vars` is gitignored; `.dev.vars.example` documents the keys.
- If you believe a secret leaked, rotate it first, then report.
