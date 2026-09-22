import type { ReportInput } from './summary';
import type { Finding, FindingCategory } from '../finding';

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  availability: 'Being reachable',
  'transport-security': 'Secure connection',
  'security-headers': 'Browser-level protections',
  privacy: 'Privacy basics',
  'content-quality': 'Links and content',
  accessibility: 'Accessibility',
};

const CATEGORY_ORDER: FindingCategory[] = [
  'availability',
  'transport-security',
  'security-headers',
  'privacy',
  'content-quality',
  'accessibility',
];

export function renderClientReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push('# Website review — plain-language report');
  lines.push('');
  lines.push(`**Website reviewed:** ${input.targetUrl}`);
  lines.push(`**Date of review:** ${input.generatedAt}`);
  lines.push(`**Source of observations:** ${input.source === 'live' ? 'direct public visit' : 'recorded demonstration data'}`);
  lines.push('');
  lines.push('## In one paragraph');
  lines.push('');
  lines.push(paragraphFor(input));
  lines.push('');

  if (input.findings.length === 0) {
    lines.push('## What we found');
    lines.push('');
    lines.push(
      'Nothing in our checklist needed attention on the day of this review. The checks we ran are a small, clearly defined set, listed at the end of this report.',
    );
    lines.push('');
  } else {
    lines.push('## What we found');
    lines.push('');
    for (const category of CATEGORY_ORDER) {
      const findings = input.findings.filter((finding) => finding.category === category);
      if (findings.length === 0) continue;
      lines.push(`### ${CATEGORY_LABELS[category]}`);
      lines.push('');
      for (const finding of findings) {
        lines.push(...findingBlock(finding));
      }
    }
  }

  lines.push('## What this review is, and what it is not');
  lines.push('');
  lines.push(
    'This is a passive review of the public surface of the website: what any ordinary visitor or search engine could observe. It is not a security assessment, not a penetration test, and not a legal or compliance review. It does not test for vulnerabilities, does not attempt to access anything private, and makes no finding of unlawful processing. Where we mention privacy or cookies, we are describing observable indicators that are worth a human review — nothing more.',
  );
  lines.push('');
  lines.push('## The checks performed');
  lines.push('');
  lines.push('- A public visit over HTTPS and over plain HTTP to compare behaviour');
  lines.push('- A review of common security headers the site sends to browsers');
  lines.push('- A check for privacy, legal, terms, contact and accessibility links, and whether the privacy link works');
  lines.push('- A look for widely used cookie-consent tools in the delivered page');
  lines.push('- A sample of internal links to see if any are broken');
  lines.push('- A light review of public technology indicators and basic accessibility signals');
  lines.push('');
  lines.push(
    'Every statement in this report is backed by a recorded observation with a timestamp. The technical companion report lists them with exact reproduction steps.',
  );
  lines.push('');

  return lines.join('\n');
}

function paragraphFor(input: ReportInput): string {
  const { critical, review, informational, total } = input.summary.counts;
  if (total === 0) {
    return 'We checked a defined set of public website basics. All of them looked the way we would expect, and nothing needed attention.';
  }
  if (critical > 0) {
    return 'We could not complete the main visit to the website, so parts of the review are missing. A short manual check by your team is the sensible next step; the technical report explains exactly what happened.';
  }
  if (review > 0) {
    return `The website works, and we found ${review} item${review === 1 ? '' : 's'} worth a closer look and ${informational} minor observation${informational === 1 ? '' : 's'}. None of them are emergencies; each has a plain-language explanation and a suggested next step below.`;
  }
  return `The website looks healthy in the checks we ran. We noted ${informational} small observation${informational === 1 ? '' : 's'} that you may want to look at when convenient.`;
}

function findingBlock(finding: Finding): string[] {
  return [
    `**${finding.title}**`,
    '',
    finding.clientExplanation,
    '',
    `_Suggested next step:_ ${finding.howToFix}`,
    '',
  ];
}
