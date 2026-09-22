import type { Rule } from './types';
import { boolOf, buildFinding, dataOf, strOf } from './types';
import { CHECK_IDS } from '../contracts';
import { HEADER_SPECS, FRAME_PROTECTION_HEADER, type HeaderSpec } from '../scanners/security-headers';
import type { EvidenceRecord } from '../evidence';

const VERSION = '1.0.0';

function absentHeader(index: { first(checkId: string): EvidenceRecord | undefined }, name: string): EvidenceRecord | null {
  const record = index.first(CHECK_IDS.headerPresence(name));
  if (record === undefined || record.state !== 'OBSERVED') return null;
  return boolOf(record, 'present') === false ? record : null;
}

function specOf(name: string): HeaderSpec {
  const spec = HEADER_SPECS.find((candidate) => candidate.name === name);
  if (spec === undefined) throw new Error(`Unknown header spec: ${name}`);
  return spec;
}

function headerRule(spec: HeaderSpec): Rule {
  return {
    id: `headers.${spec.name}-not-observed`,
    version: VERSION,
    title: `${spec.label} header was not observed`,
    category: spec.category,
    severity: spec.severityIfMissing,
    standards: spec.standards,
    evaluate(index, ctx) {
      const record = absentHeader(index, spec.name);
      if (record === null) return null;
      return buildFinding({
        rule: headerRule(spec),
        state: 'OBSERVED',
        confidence: 'medium',
        summary: `The observed HTTPS response from ${ctx.targetUrl} did not include a ${spec.label} header.`,
        whyItMatters: spec.whyItMatters,
        howToReproduce: [
          `Run: curl -sI ${ctx.targetUrl}`,
          `Check whether the response includes a ${spec.label} header.`,
        ],
        howToFix: spec.howToFix,
        clientExplanation: clientTextFor(spec.name),
        evidenceIds: [record.evidenceId],
        limitations: ['Absence was observed in one response to the site root; configuration can differ per route.'],
      });
    },
  };
}

export const cspNotObservedRule = headerRule(specOf('content-security-policy'));
export const xctoNotObservedRule = headerRule(specOf('x-content-type-options'));
export const referrerPolicyNotObservedRule = headerRule(specOf('referrer-policy'));
export const permissionsPolicyNotObservedRule = headerRule(specOf('permissions-policy'));

export const clickjackingProtectionNotObservedRule: Rule = {
  id: 'headers.clickjacking-protection-not-observed',
  version: VERSION,
  title: 'No framing protection was observed (X-Frame-Options or CSP frame-ancestors)',
  category: 'security-headers',
  severity: 'review',
  standards: ['OWASP Clickjacking Defence Cheat Sheet'],
  evaluate(index, ctx) {
    const xfo = absentHeader(index, FRAME_PROTECTION_HEADER);
    if (xfo === null) return null;

    const csp = index.first(CHECK_IDS.headerPresence('content-security-policy'));
    const cspValue = csp === undefined ? null : strOf(csp, 'value');
    if (cspValue !== null && /frame-ancestors/i.test(cspValue)) return null;

    const evidenceIds = csp === undefined ? [xfo.evidenceId] : [xfo.evidenceId, csp.evidenceId];
    return buildFinding({
      rule: clickjackingProtectionNotObservedRule,
      state: 'OBSERVED',
      confidence: 'medium',
      summary: `Neither an X-Frame-Options header nor a Content-Security-Policy frame-ancestors directive was observed in the HTTPS response from ${ctx.targetUrl}.`,
      whyItMatters:
        'Without framing protection, other sites can embed this site in an iframe. Combined with other weaknesses that can enable clickjacking, where users are tricked into clicking hidden controls. This is a mitigation gap, not proof of an attack.',
      howToReproduce: [
        `Run: curl -sI ${ctx.targetUrl}`,
        'Check for an X-Frame-Options header, or for frame-ancestors inside a Content-Security-Policy header.',
      ],
      howToFix:
        'Add `X-Frame-Options: DENY` (or SAMEORIGIN if framing by your own site is required), or set a CSP frame-ancestors directive such as `frame-ancestors \'self\'`.',
      clientExplanation:
        'The site does not currently tell browsers to refuse being displayed inside another site’s frame. Adding one standard header or CSP directive closes this well-known trick; it is a routine hardening step.',
      evidenceIds,
      limitations: ['Absence was observed in one response to the site root; configuration can differ per route.'],
    });
  },
};

export const headerRules: Rule[] = [
  cspNotObservedRule,
  clickjackingProtectionNotObservedRule,
  xctoNotObservedRule,
  referrerPolicyNotObservedRule,
  permissionsPolicyNotObservedRule,
];

function clientTextFor(name: string): string {
  switch (name) {
    case 'content-security-policy':
      return 'The site does not send a Content-Security-Policy, an extra browser-level guard that limits which scripts can run. Many sites work fine without it, but it is one of the strongest additional protections available and is worth adding when the site is next updated.';
    case 'x-content-type-options':
      return 'One small header (X-Content-Type-Options) is not set. It tells browsers to trust the declared file types, and its absence is a minor hardening gap with a one-line fix on most hosts.';
    case 'referrer-policy':
      return 'The site does not explicitly control how much address information is shared with other sites when visitors click links. Setting a standard policy is a small, recommended improvement.';
    case 'permissions-policy':
      return 'The site does not switch off browser features it does not use (like camera or microphone access). This is an optional hardening step and low urgency.';
    default:
      return 'This response header was not observed. Review the technical report for details.';
  }
}

export function headerEvidenceDebug(record: EvidenceRecord): string {
  const data = dataOf(record);
  return `${record.checkId}:${String(data['present'])}`;
}
