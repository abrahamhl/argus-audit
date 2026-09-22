import type { Rule } from './types';
import { boolOf, buildFinding, responseUsable, strOf } from './types';
import { CHECK_IDS } from '../contracts';

const VERSION = '1.0.0';

export const securityTxtMissingRule: Rule = {
  id: 'security.txt-missing',
  version: VERSION,
  title: 'No security.txt was found',
  category: 'content-quality',
  severity: 'informational',
  standards: ['RFC 9116 — security.txt'],
  evaluate(index, ctx) {
    if (!responseUsable(index.first(CHECK_IDS.httpsResponse))) return null;
    const record = index.first(CHECK_IDS.securityTxt);
    if (record === undefined || record.state !== 'OBSERVED') return null;
    if (boolOf(record, 'found') !== false) return null;
    const host = ctx.targetUrl.replace('https://', '').replace(/\/$/, '');
    return buildFinding({
      rule: securityTxtMissingRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `Neither /.well-known/security.txt nor /security.txt returned a document on ${host}.`,
      whyItMatters:
        'A security.txt gives security researchers and reporters a standard, machine-readable way to contact the organisation about vulnerabilities. Its absence is common and low urgency; it is an invitation channel, not a control.',
      howToReproduce: [
        `Run: curl -sI ${ctx.targetUrl.replace(/\/$/, '')}/.well-known/security.txt`,
        `and: curl -sI ${ctx.targetUrl.replace(/\/$/, '')}/security.txt`,
        'Both returning 404 confirms the observation.',
      ],
      howToFix:
        'Publish a security.txt at /.well-known/security.txt with at least a Contact field and an Expires field, per RFC 9116.',
      clientExplanation:
        'The site does not publish the standard file that tells security researchers where to report a problem. Adding it is a small, one-page improvement that professionalises how reports reach the business.',
      evidenceIds: [record.evidenceId],
      limitations: ['Only the two standard paths were checked, once.'],
    });
  },
};

export const securityTxtExpiredRule: Rule = {
  id: 'security.txt-expired',
  version: VERSION,
  title: 'The published security.txt has expired',
  category: 'content-quality',
  severity: 'informational',
  standards: ['RFC 9116 — security.txt'],
  evaluate(index, ctx) {
    const record = index.first(CHECK_IDS.securityTxt);
    if (record === undefined || record.state !== 'OBSERVED') return null;
    if (boolOf(record, 'found') !== true || boolOf(record, 'expired') !== true) return null;
    return buildFinding({
      rule: securityTxtExpiredRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `The security.txt found at ${ctx.targetUrl} carries an Expires date in the past.`,
      whyItMatters:
        'RFC 9116 uses the Expires field so readers can trust that the contact information is still maintained. An expired file signals that the channel may be stale.',
      howToReproduce: [
        `Run: curl -s ${ctx.targetUrl.replace(/\/$/, '')}/.well-known/security.txt`,
        'Compare the Expires field with the current date.',
      ],
      howToFix: 'Update the Expires field (and refresh the contact details) and republish the file.',
      clientExplanation:
        'The security contact file on the site is out of date. Refreshing the expiry date and confirming the contact address keeps the channel trustworthy.',
      evidenceIds: [record.evidenceId],
      limitations: ['Expiry is judged against the audit timestamp.'],
    });
  },
};

export const securityRules: Rule[] = [securityTxtMissingRule, securityTxtExpiredRule];

export function securityTxtContactCount(record: { data: unknown }): string | null {
  if (record.data === null || typeof record.data !== 'object' || Array.isArray(record.data)) return null;
  const count = (record.data as Record<string, unknown>)['contactCount'];
  return typeof count === 'number' ? String(count) : null;
}

export { strOf };
