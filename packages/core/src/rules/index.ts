import type { EvidenceRecord } from '../evidence';
import { compareFindings, type Finding } from '../finding';
import { createEvidenceIndex, type Rule, type RuleContext } from './types';
import { transportRules } from './transport';
import { headerRules } from './headers';
import { privacyRules } from './privacy';
import { linkRules } from './links';
import { accessibilityRules } from './accessibility';
import { emailRules } from './email';
import { securityRules } from './security';

export type { Rule, RuleContext, EvidenceIndex } from './types';
export { createEvidenceIndex } from './types';

/** Rule order defines report order for equal severities. Part of the methodology. */
export const allRules: Rule[] = [
  ...transportRules,
  ...headerRules,
  ...privacyRules,
  ...emailRules,
  ...securityRules,
  ...linkRules,
  ...accessibilityRules,
];

export function evaluateRules(evidence: EvidenceRecord[], context: RuleContext): Finding[] {
  const index = createEvidenceIndex(evidence);
  const findings: Finding[] = [];
  for (const rule of allRules) {
    const finding = rule.evaluate(index, context);
    if (finding !== null) findings.push(finding);
  }
  return findings.sort(compareFindings);
}
