import type { EvidenceState } from './states';

export type Severity = 'critical' | 'review' | 'informational';
export type Confidence = 'high' | 'medium' | 'low';

export type FindingCategory =
  | 'availability'
  | 'transport-security'
  | 'security-headers'
  | 'privacy'
  | 'content-quality'
  | 'accessibility';

export interface Finding {
  /** Stable within the audit. In V0: equals the rule id (one finding per rule). */
  findingId: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  /** Nature of the claim, never collapsed into "the site is broken/insecure". */
  state: EvidenceState;
  confidence: Confidence;
  /** What we observed — neutral, deterministic, traceable to `evidenceIds`. */
  summary: string;
  whyItMatters: string;
  howToReproduce: string[];
  howToFix: string;
  /** Non-alarming, non-legal explanation used by the CLIENT report. */
  clientExplanation: string;
  /** Every finding points back to raw evidence. Never empty. */
  evidenceIds: string[];
  standards: string[];
  limitations: string[];
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Needs attention',
  review: 'Worth a look',
  informational: 'For information',
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'review', 'informational'];

export function compareFindings(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  if (bySeverity !== 0) return bySeverity;
  return a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0;
}
