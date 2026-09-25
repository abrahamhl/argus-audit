/**
 * Forbidden-claim vocabulary. Used twice:
 *  - tests: every rendered report must not contain these phrases;
 *  - runtime: optional AI rephrasing is rejected if it introduces one.
 *
 * The list deliberately targets accusations, legal verdicts, guarantees and
 * fear marketing — not descriptive words like "guarantee" used in a negation.
 */
export const FORBIDDEN_CLAIM_PHRASES: readonly string[] = [
  'violates gdpr',
  'gdpr violation',
  'violation of the gdpr',
  'non-compliant',
  'noncompliant',
  'illegal',
  'fine of',
  'fines of',
  'will be fined',
  'lawsuit',
  'prosecut',
  'certified secure',
  'guaranteed secure',
  'guaranteed to',
  'hacked',
  'urgent action',
  'act now',
  'limited time',
];

export function findForbiddenClaim(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_CLAIM_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}
