# Evidence contract

Version 1.0.0 · Methodology 0.1.0

Every conclusion in Argus Audit is a pure function of recorded evidence. This
document defines the contract between scanners, rules and reports.

## 1. States

| State | Meaning | Example |
|---|---|---|
| `VERIFIED` | Corroborated by more than one observation, or derived deterministically from verified inputs | Reserved for future multi-observation checks |
| `OBSERVED` | Directly present in the captured public response, including a documented absence | "No `Content-Security-Policy` header in the observed response" |
| `INFERRED` | Interpretation derived from observed indicators | "WordPress indicator found in `wp-content` paths" |
| `NOT_CHECKED` | Deliberately out of scope or impossible in this runtime, with a recorded reason | TLS certificate chain |
| `ERROR` | Attempted and did not complete (network, timeout, blocking) | `ENOTFOUND` on HTTPS request |

Rules never collapse these states. A finding carries the state of its claim;
the confidence field is separate and describes sampling strength.

## 2. EvidenceRecord

```
evidenceId     stable: `${auditId}:${checkId}#${n}` (n per checkId, in scanner order)
auditId        audit this record belongs to
scannerId      e.g. "headers.security"
scannerVersion semver of the scanner implementation
checkId        stable check identifier, e.g. "headers.presence.content-security-policy"
kind           http.response | tls.indicator | header.presence | cookie.flags |
               page.presence | page.reachability | link.status | tech.indicator |
               a11y.signal | internal
state          one of the five states above
subject        the URL, header name, link, etc. the evidence is about
method         GET | HEAD | html-scan | header-scan | sample | none | internal
observedAt     ISO timestamp from the injected clock
data           structured, report-safe observation (no cookie values, no full HTML)
provenance     source (live|fixture), requestedUrl, finalUrl, httpStatus,
               redirectChain, fixtureId, recordedAt, contentSha256, contentBytes,
               contentTruncated
limitations    non-empty list of what this record cannot establish
```

## 3. Finding

```
findingId      in V0 equal to the rule id
ruleId/version deterministic rule that produced it
severity       critical | review | informational
category       availability | transport-security | security-headers | privacy |
               content-quality | accessibility
state          the claim's evidence state (see above)
confidence     high | medium | low
summary        neutral description of the observation
whyItMatters   context, never a legal claim
howToReproduce concrete steps a third party can follow
howToFix       actionable, vendor-neutral remediation
clientExplanation plain-language text (may be rephrased by optional AI;
                  never replaced by new claims)
evidenceIds    at least one; every id must exist in the audit
standards      references (RFCs, OWASP, WCAG) or empty
limitations    what the finding cannot establish
```

Runtime invariants (also enforced by tests):

1. A finding is never constructed without evidence references.
2. Every referenced evidence id exists in the same audit.
3. Scanners run in a fixed order; changing it changes evidence ids and requires
   a `METHODOLOGY_VERSION` bump.
4. Identical inputs (target, transport data, clock, auditId) produce
   byte-identical output, including reports.

## 4. Provenance and freshness

- `source: live` — the record came from real network requests during the audit.
- `source: fixture` — the record replays a recorded response; `recordedAt` is
  the fixture recording time, not the demo run time.
- Report freshness is computed from `recordedAt` for fixtures and `observedAt`
  for live audits. Demo reports say **recorded demo data** everywhere.

## 5. Rule evaluation

Rules are pure functions `(EvidenceIndex, RuleContext) → Finding | null`:

- `EvidenceIndex` answers by `checkId` only; rules cannot inspect network state
  or call AI.
- Missing evidence means "no claim" — rules never fire on data they did not
  receive.
- Header absence rules require the corresponding presence evidence to be
  `OBSERVED`; if the site was unreachable, the only finding is the ERROR
  finding for unreachability.

## 6. Reporting

Three renderers over the same data:

- **SIMPLE** — what matters, what to do next; no raw JSON.
- **ENGINEER** — metadata, per-finding rule/state/confidence, evidence JSON,
  reproduction, standards, limitations; methodology version and audit id.
- **CLIENT** — plain language, grouped by area; no fear marketing, no invented
  fines, no urgency; explicit statement that this is not a security assessment
  or legal review.

All three are generated deterministically from `AuditResult`. Optional AI may
only substitute the `clientExplanation` strings; if it fails, the deterministic
text stands.
