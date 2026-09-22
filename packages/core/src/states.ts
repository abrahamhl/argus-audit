/**
 * Explicit evidence states. These are never collapsed into one another.
 *
 * VERIFIED     - independently corroborated by two or more observations, or a
 *                deterministic derivation whose inputs were all verified.
 * OBSERVED     - directly present in captured data (a header, a status code,
 *                a link, a string match, or the documented absence of one).
 * INFERRED     - an interpretation that goes beyond the raw capture
 *                (technology identification, "no consent tool detected").
 * NOT_CHECKED  - deliberately out of scope for this methodology version, or
 *                impossible in the current runtime. Always carries a reason.
 * ERROR        - the check was attempted and failed (network error, timeout,
 *                blocking status). Never presented as a negative finding.
 */
export const EVIDENCE_STATES = ['VERIFIED', 'OBSERVED', 'INFERRED', 'NOT_CHECKED', 'ERROR'] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const STATE_DESCRIPTIONS: Record<EvidenceState, string> = {
  VERIFIED: 'Corroborated by more than one observation or a deterministic derivation of verified inputs.',
  OBSERVED: 'Directly present in the captured public response (including a documented absence).',
  INFERRED: 'An interpretation derived from observed indicators, not a direct observation.',
  NOT_CHECKED: 'Deliberately out of scope or not possible in this environment. The reason is recorded.',
  ERROR: 'The check was attempted and did not complete (network error, timeout or blocking).',
};

export function isEvidenceState(value: unknown): value is EvidenceState {
  return typeof value === 'string' && (EVIDENCE_STATES as readonly string[]).includes(value);
}
