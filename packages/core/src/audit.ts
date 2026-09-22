import { DEFAULT_LIMITS, type Limits, type Scanner, type ScanContext } from './contracts';
import { EvidenceBuilder, type EvidenceRecord } from './evidence';
import { AuditError } from './errors';
import type { Finding } from './finding';
import { evaluateRules } from './rules';
import { normalizeTargetInput, type NormalizedTarget } from './url-guard';
import { HttpClient, MemoTransport } from './transport/client';
import type { HttpTransport } from './transport/types';
import { defaultScanners } from './scanners';
import { computeFreshness, computeSummary, renderReports, type AuditSummary, type DataFreshness, type ReportMode } from './report';
import { METHODOLOGY_VERSION } from './version';
import { systemClock, type Clock } from './util/clock';
import { sha256Hex, stableJson } from './util/hash';
import { findForbiddenClaim } from './claims';
import { templateExplainer, type ExplanationProvider } from './explain/types';
import { unavailableDnsResolver, type DnsResolver } from './dns/types';

export interface AuditOptions {
  target: string;
  transport: HttpTransport;
  dnsResolver?: DnsResolver;
  clock?: Clock;
  auditId?: string;
  limits?: Partial<Limits>;
  explainer?: ExplanationProvider;
  scanners?: Scanner[];
  source?: 'live' | 'fixture';
}

export interface AuditResult {
  auditId: string;
  target: { input: string; hostname: string; url: string };
  startedAt: string;
  finishedAt: string;
  generatedAt: string;
  methodologyVersion: string;
  source: 'live' | 'fixture';
  evidence: EvidenceRecord[];
  findings: Finding[];
  /** SHA-256 over the canonical JSON of the evidence set (tamper evidence). */
  evidenceHash: string;
  reports: Record<ReportMode, string>;
  summary: AuditSummary;
  freshness: DataFreshness;
  limitations: string[];
  explainer: { id: string; enabled: boolean; applied: number; error: string | null };
}

const GLOBAL_LIMITATIONS = [
  'Passive public-surface checks only: no authentication, no exploitation, no private areas, no hidden-directory discovery.',
  'Observations come from one network vantage point at one point in time; other locations or moments may differ.',
  'No legal or compliance conclusion is drawn. Observations are technical indicators for human review.',
];

export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const normalized = normalizeTargetInput(options.target);
  if (!normalized.ok) {
    throw new AuditError(normalized.code, normalized.message);
  }

  const target: NormalizedTarget = normalized.target;
  const clock = options.clock ?? systemClock;
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits };
  const source = options.source ?? 'live';
  const auditId = options.auditId ?? crypto.randomUUID();
  const scanners = options.scanners ?? defaultScanners;
  const explainer = options.explainer ?? templateExplainer;

  const startedAt = clock.nowIso();
  const memo = new MemoTransport(options.transport);
  const http = new HttpClient(memo, clock, {
    maxRedirects: limits.maxRedirects,
    deadlineMs: limits.auditBudgetMs,
    maxTotalRequests: limits.maxTotalRequests,
    validateRedirects: true,
  });

  const evidenceBuilder = new EvidenceBuilder(auditId, clock);
  const context: ScanContext = {
    auditId,
    target,
    clock,
    http,
    dns: options.dnsResolver ?? unavailableDnsResolver,
    limits,
    source,
    evidence: evidenceBuilder,
  };

  for (const scanner of scanners) {
    try {
      await scanner.run(context);
    } catch (error) {
      evidenceBuilder.add({
        scannerId: scanner.id,
        scannerVersion: scanner.version,
        checkId: `scanner.${scanner.id}.internal-error`,
        kind: 'internal',
        state: 'ERROR',
        subject: scanner.id,
        method: 'internal',
        data: {
          scanner: scanner.id,
          message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown scanner error',
        },
        provenance: { source, requestedUrl: target.httpsUrl },
        limitations: ['The scanner failed and produced no usable evidence.'],
      });
    }
  }

  const evidence = [...evidenceBuilder.records];
  const evidenceHash = await sha256Hex(stableJson(evidence));
  const generatedAt = clock.nowIso();

  let findings = evaluateRules(evidence, {
    generatedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    targetUrl: target.httpsUrl,
  });

  const explainerStatus: AuditResult['explainer'] = {
    id: explainer.id,
    enabled: explainer.enabled,
    applied: 0,
    error: null,
  };

  if (explainer.enabled) {
    const enriched: Finding[] = [];
    for (const finding of findings) {
      try {
        const related = evidence.filter((record) => finding.evidenceIds.includes(record.evidenceId));
        const result = await explainer.explain({ finding, evidence: related });
        const replacement = result?.clientExplanation;
        const forbidden = replacement === undefined ? null : findForbiddenClaim(replacement);
        if (typeof replacement === 'string' && replacement.trim().length > 0 && forbidden === null) {
          enriched.push({ ...finding, clientExplanation: replacement.trim() });
          explainerStatus.applied += 1;
        } else {
          if (forbidden !== null && explainerStatus.error === null) {
            explainerStatus.error = `AI output rejected (forbidden claim phrase: "${forbidden}")`;
          }
          enriched.push(finding);
        }
      } catch (error) {
        explainerStatus.error = error instanceof Error ? error.message.slice(0, 200) : 'explainer failed';
        enriched.push(finding);
      }
    }
    findings = enriched;
  }

  const summary = computeSummary(findings, evidence);
  const freshness = computeFreshness(evidence, generatedAt, source);
  const limitations = [...GLOBAL_LIMITATIONS];
  if (source === 'fixture') {
    limitations.push('Results come from recorded fixture data, not a live visit to the site.');
  }

  const finishedAt = clock.nowIso();
  const reports = renderReports({
    auditId,
    targetUrl: target.httpsUrl,
    hostname: target.hostname,
    generatedAt,
    startedAt,
    finishedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    source,
    findings,
    evidence,
    evidenceHash,
    summary,
    freshness,
    limitations,
  });

  return {
    auditId,
    target: { input: target.input, hostname: target.hostname, url: target.httpsUrl },
    startedAt,
    finishedAt,
    generatedAt,
    methodologyVersion: METHODOLOGY_VERSION,
    source,
    evidence,
    findings,
    evidenceHash,
    reports,
    summary,
    freshness,
    limitations,
    explainer: explainerStatus,
  };
}
