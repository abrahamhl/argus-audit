import type { ReportInput } from './summary';
import { metaBlock } from './simple';
import type { EvidenceRecord } from '../evidence';
import { stableJson, truncate } from '../util/hash';

export function renderEngineerReport(input: ReportInput): string {
  const lines: string[] = [];
  const evidenceById = new Map(input.evidence.map((record) => [record.evidenceId, record]));

  lines.push('# Argus Audit — Engineer report');
  lines.push('');
  lines.push(...metaBlock(input));
  lines.push(
    `**Window:** ${input.startedAt} → ${input.finishedAt} · **Checks executed:** ${input.summary.checksRun} · **Evidence records:** ${input.summary.evidenceCount}`,
  );
  lines.push('');

  if (input.findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No rule produced a finding for this target.');
    lines.push('');
  }

  for (const finding of input.findings) {
    lines.push(`## ${finding.findingId} — ${finding.title}`);
    lines.push('');
    lines.push(
      `- Severity: **${finding.severity}** · Claim state: **${finding.state}** · Confidence: **${finding.confidence}**`,
    );
    lines.push(`- Rule: \`${finding.ruleId}@${finding.ruleVersion}\` · Category: ${finding.category}`);
    lines.push(`- Summary: ${finding.summary}`);
    lines.push('');
    lines.push('### Why it matters');
    lines.push('');
    lines.push(finding.whyItMatters);
    lines.push('');

    lines.push('### Evidence');
    lines.push('');
    for (const evidenceId of finding.evidenceIds) {
      const record = evidenceById.get(evidenceId);
      if (record === undefined) {
        lines.push(`- \`${evidenceId}\` — MISSING (internal inconsistency; please report this)`);
        continue;
      }
      lines.push(...evidenceBlock(record));
    }
    lines.push('');

    lines.push('### How to reproduce');
    lines.push('');
    finding.howToReproduce.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
    lines.push('');

    lines.push('### How to fix');
    lines.push('');
    lines.push(finding.howToFix);
    lines.push('');

    if (finding.standards.length > 0) {
      lines.push('### Standards / references');
      lines.push('');
      for (const standard of finding.standards) {
        lines.push(`- ${standard}`);
      }
      lines.push('');
    }

    if (finding.limitations.length > 0) {
      lines.push('### Limitations of this finding');
      lines.push('');
      for (const limitation of finding.limitations) {
        lines.push(`- ${limitation}`);
      }
      lines.push('');
    }
  }

  lines.push('## Audit limitations');
  lines.push('');
  for (const limitation of input.limitations) {
    lines.push(`- ${limitation}`);
  }
  lines.push('');
  lines.push(
    '_This report contains technical observations of the public surface of the target, collected passively. It is not a security assessment, penetration test, legal review or compliance certification._',
  );
  lines.push('');

  return lines.join('\n');
}

function evidenceBlock(record: EvidenceRecord): string[] {
  const provenance = record.provenance;
  const lines: string[] = [];
  lines.push(
    `- \`${record.evidenceId}\` · check \`${record.checkId}\` · ${record.state} · method ${record.method} · observed ${record.observedAt}`,
  );
  lines.push(`  - Request: ${provenance.requestedUrl}${provenance.httpStatus === undefined ? '' : ` → HTTP ${provenance.httpStatus}`}${provenance.finalUrl !== undefined && provenance.finalUrl !== provenance.requestedUrl ? ` → ${provenance.finalUrl}` : ''}`);
  if (provenance.recordedAt !== undefined) {
    lines.push(`  - Recorded at: ${provenance.recordedAt} (fixture ${provenance.fixtureId ?? 'unknown'})`);
  }
  if (provenance.contentSha256 !== undefined) {
    lines.push(`  - Body SHA-256: \`${provenance.contentSha256}\` (${provenance.contentBytes ?? '?'} bytes${provenance.contentTruncated === true ? ', truncated' : ''})`);
  }
  lines.push('  - Data:');
  lines.push('');
  lines.push('```json');
  lines.push(truncate(stableJson(record.data), 4000));
  lines.push('```');
  for (const limitation of record.limitations) {
    lines.push(`  - Limitation: ${limitation}`);
  }
  return lines;
}
