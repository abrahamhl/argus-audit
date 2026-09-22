import type { EvidenceRecord } from '../evidence';
import type { Severity } from '../finding';
import type { Finding } from '../finding';
import { EVIDENCE_STATES, type EvidenceState } from '../states';

export type ReportMode = 'simple' | 'engineer' | 'client';

export interface AuditSummary {
  headline: string;
  /** Overall state of the evidence base: ERROR (collection failed), OBSERVED, or NOT_CHECKED. */
  state: EvidenceState;
  counts: { critical: number; review: number; informational: number; total: number };
  evidenceStates: Record<EvidenceState, number>;
  checksRun: number;
  evidenceCount: number;
}

export interface DataFreshness {
  source: 'live' | 'fixture';
  oldestEvidenceAt: string | null;
  newestEvidenceAt: string | null;
  /** Age in seconds of the newest underlying data point (recordedAt for fixtures). */
  ageSeconds: number | null;
  fixtureRecordedAt: string | null;
}

export interface ReportInput {
  auditId: string;
  targetUrl: string;
  hostname: string;
  generatedAt: string;
  startedAt: string;
  finishedAt: string;
  methodologyVersion: string;
  source: 'live' | 'fixture';
  findings: Finding[];
  evidence: EvidenceRecord[];
  summary: AuditSummary;
  freshness: DataFreshness;
  limitations: string[];
}

export function computeSummary(findings: Finding[], evidence: EvidenceRecord[]): AuditSummary {
  const counts = {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    review: findings.filter((finding) => finding.severity === 'review').length,
    informational: findings.filter((finding) => finding.severity === 'informational').length,
    total: findings.length,
  };

  const evidenceStates = Object.fromEntries(
    EVIDENCE_STATES.map((state) => [state, evidence.filter((record) => record.state === state).length]),
  ) as Record<EvidenceState, number>;

  const httpsError = evidence.some(
    (record) => record.checkId === 'tls.https.reachable' && record.state === 'ERROR',
  );
  const state: EvidenceState = httpsError ? 'ERROR' : evidence.length > 0 ? 'OBSERVED' : 'NOT_CHECKED';

  return {
    headline: headlineFor(counts, httpsError),
    state,
    counts,
    evidenceStates,
    checksRun: new Set(evidence.map((record) => record.checkId)).size,
    evidenceCount: evidence.length,
  };
}

export function computeFreshness(
  evidence: EvidenceRecord[],
  generatedAt: string,
  source: 'live' | 'fixture',
): DataFreshness {
  const timestamps = evidence
    .map((record) =>
      source === 'fixture' && record.provenance.recordedAt !== undefined
        ? record.provenance.recordedAt
        : record.observedAt,
    )
    .filter((value) => value.length > 0)
    .sort();

  const oldest = timestamps[0] ?? null;
  const newest = timestamps[timestamps.length - 1] ?? null;
  const generatedMs = Date.parse(generatedAt);
  const newestMs = newest === null ? Number.NaN : Date.parse(newest);
  const ageSeconds =
    newest === null || Number.isNaN(newestMs) || Number.isNaN(generatedMs)
      ? null
      : Math.max(0, Math.round((generatedMs - newestMs) / 1000));

  const fixtureRecordedAt =
    evidence.find((record) => record.provenance.recordedAt !== undefined)?.provenance.recordedAt ?? null;

  return { source, oldestEvidenceAt: oldest, newestEvidenceAt: newest, ageSeconds, fixtureRecordedAt };
}

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  return {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    review: findings.filter((finding) => finding.severity === 'review').length,
    informational: findings.filter((finding) => finding.severity === 'informational').length,
  };
}

function headlineFor(
  counts: { critical: number; review: number; informational: number; total: number },
  httpsError: boolean,
): string {
  if (httpsError) {
    return 'Audit incomplete: the website could not be reached over HTTPS.';
  }
  if (counts.critical > 0) {
    return `${counts.critical} finding${counts.critical === 1 ? '' : 's'} need attention.`;
  }
  if (counts.review > 0) {
    return `${counts.review} finding${counts.review === 1 ? '' : 's'} worth a look; nothing critical observed.`;
  }
  if (counts.informational > 0) {
    return `No critical or review findings; ${counts.informational} informational observation${counts.informational === 1 ? '' : 's'}.`;
  }
  return 'No findings from the checks we ran.';
}
