import type { Rule } from './types';
import { boolOf, buildFinding, numOf } from './types';
import { CHECK_IDS } from '../contracts';

const VERSION = '1.0.0';

export const brokenLinksSampleRule: Rule = {
  id: 'links.broken-sample',
  version: VERSION,
  title: 'A sample of internal links returned error responses',
  category: 'content-quality',
  severity: 'informational',
  standards: [],
  evaluate(index, ctx) {
    const summary = index.first(CHECK_IDS.linkSummary);
    if (summary === undefined || summary.state !== 'OBSERVED') return null;
    const broken = numOf(summary, 'broken') ?? 0;
    const sampled = numOf(summary, 'sampled') ?? 0;
    if (broken === 0 || sampled === 0) return null;

    const brokenRecords = index
      .allOf(CHECK_IDS.linkStatus)
      .filter((record) => boolOf(record, 'broken') === true);
    if (brokenRecords.length === 0) return null;

    const examples = brokenRecords
      .slice(0, 3)
      .map((record) => {
        const status = numOf(record, 'status');
        return `${record.subject} (HTTP ${status ?? 'error'})`;
      })
      .join(', ');

    return buildFinding({
      rule: brokenLinksSampleRule,
      state: 'OBSERVED',
      confidence: 'high',
      summary: `${broken} of ${sampled} sampled internal links from ${ctx.targetUrl} returned an error status. Examples: ${examples}.`,
      whyItMatters:
        'Broken links frustrate visitors and can signal stale content, but on their own they are a content-quality issue rather than a security problem.',
      howToReproduce: [
        'Open each link listed in the evidence from your browser.',
        'Or check one directly, for example: curl -sI "<link url>"',
      ],
      howToFix:
        'Update or remove the failing links, or restore the target pages. Re-run the audit afterwards to confirm the sample is clean.',
      clientExplanation:
        'A few links on the home page currently lead to missing or error pages. It is usually a five-minute content fix, and it helps visitors (and search engines) trust the site.',
      evidenceIds: [summary.evidenceId, ...brokenRecords.map((record) => record.evidenceId)],
      limitations: [
        'Only the sampled links listed in the evidence were checked, on one occasion.',
        'Rate-limited responses are treated as inconclusive and never counted as broken.',
      ],
    });
  },
};

export const linkRules: Rule[] = [brokenLinksSampleRule];
