import type { ReportInput } from './summary';
import type { Finding } from '../finding';

export function renderSimpleReport(input: ReportInput): string {
  const lines: string[] = [];
  lines.push(`# Argus Audit — Simple report`);
  lines.push('');
  lines.push(...metaBlock(input));

  lines.push('## What should I care about?');
  lines.push('');
  lines.push(input.summary.headline);
  lines.push('');

  if (input.findings.length === 0) {
    lines.push('Nothing in the checks we ran needs attention today.');
    lines.push('');
  } else {
    const groups: { label: string; findings: Finding[] }[] = [
      { label: 'Needs attention', findings: input.findings.filter((f) => f.severity === 'critical') },
      { label: 'Worth a look', findings: input.findings.filter((f) => f.severity === 'review') },
      { label: 'For information', findings: input.findings.filter((f) => f.severity === 'informational') },
    ];
    for (const group of groups) {
      if (group.findings.length === 0) continue;
      lines.push(`### ${group.label}`);
      lines.push('');
      for (const finding of group.findings) {
        lines.push(`- **${finding.title}** — ${finding.clientExplanation}`);
        lines.push(`  - What to do: ${finding.howToFix}`);
      }
      lines.push('');
    }
  }

  lines.push('## What we checked');
  lines.push('');
  lines.push('- Whether the site answers over HTTPS and whether old http:// links are redirected');
  lines.push('- Which common security response headers are present');
  lines.push('- Whether privacy, legal, terms, contact and accessibility pages are linked, and whether the privacy link works');
  lines.push('- Whether a commonly used cookie-consent indicator appears in the delivered homepage HTML');
  lines.push('- A small sample of internal links (broken-link check)');
  lines.push('- Public technology indicators and three basic accessibility signals');
  lines.push('');

  lines.push('## What we did not check');
  lines.push('');
  lines.push('- Certificate chain, issuer and expiry (not visible to this audit runtime)');
  lines.push('- Anything behind a login, private areas, or behaviour under attack');
  lines.push('- Legal compliance of any kind. Findings are technical observations.');
  lines.push('');

  lines.push('## Read this next');
  lines.push('');
  lines.push(
    'The Engineer report lists the raw evidence and exact reproduction steps for every finding. The Client report gives the same picture without technical detail.',
  );
  lines.push('');

  const state = input.summary.evidenceStates;
  lines.push('### Evidence at a glance');
  lines.push('');
  lines.push(
    `- VERIFIED ${state.VERIFIED} · OBSERVED ${state.OBSERVED} · INFERRED ${state.INFERRED} · NOT_CHECKED ${state.NOT_CHECKED} · ERROR ${state.ERROR}`,
  );
  lines.push('');

  return lines.join('\n');
}

export function metaBlock(input: ReportInput): string[] {
  const freshness =
    input.freshness.ageSeconds === null
      ? 'unknown'
      : input.freshness.ageSeconds < 90
        ? `${input.freshness.ageSeconds} seconds`
        : `${Math.round(input.freshness.ageSeconds / 60)} minutes`;
  return [
    `**Website:** ${input.targetUrl}`,
    `**Generated:** ${input.generatedAt}`,
    `**Evidence source:** ${input.source === 'live' ? 'Live public observation' : `Recorded demo data (${input.freshness.fixtureRecordedAt ?? 'fixture'})`}`,
    `**Data freshness at generation time:** ${freshness}`,
    `**Methodology version:** ${input.methodologyVersion}`,
    `**Audit id:** ${input.auditId}`,
    '',
  ];
}
