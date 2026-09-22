import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import type { DnsAnswer, DnsRecordType, DnsResult } from '../dns/types';
import type { EvidenceRecord } from '../evidence';
import { truncate } from '../util/hash';

export const DNS_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'dns.records';

const QUERY_TYPES: DnsRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CAA'];

export interface ParsedSpf {
  present: boolean;
  raw: string | null;
  /** The qualifier of the `all` mechanism: `-`, `~`, `+`, `?` or null when absent. */
  allQualifier: string | null;
  includeCount: number;
}

export interface ParsedDmarc {
  present: boolean;
  raw: string | null;
  policy: string | null;
}

export const dnsScanner: Scanner = {
  id: SCANNER_ID,
  version: DNS_SCANNER_VERSION,
  description:
    'DNS records through the configured resolver (DNS-over-HTTPS in production, recorded fixtures in tests): A, AAAA, MX, TXT (SPF) and CAA, plus the _dmarc TXT record. Passive public lookups only.',
  async run(ctx: ScanContext): Promise<void> {
    const host = ctx.target.hostname;

    if (ctx.dns.id === 'unavailable') {
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: DNS_SCANNER_VERSION,
        checkId: CHECK_IDS.dnsSummary,
        kind: 'tech.indicator',
        state: 'NOT_CHECKED',
        subject: host,
        method: 'dns',
        data: { reason: 'no-resolver', host },
        provenance: { source: ctx.source, requestedUrl: `dns://${host}` },        limitations: ['No DNS resolver was configured, so no DNS-based claim is made.'],
      });
      return;
    }

    const results: DnsResult[] = [];
    for (const type of QUERY_TYPES.slice(0, ctx.limits.maxDnsQueries)) {
      results.push(await ctx.dns.resolve(host, type));
    }
    const dmarc = await ctx.dns.resolve(`_dmarc.${host}`, 'TXT');

    const byType = new Map<DnsRecordType, DnsResult>();
    for (const result of results) byType.set(result.type, result);

    for (const result of [...results, dmarc]) {
      addAnswerEvidence(ctx, result, host);
    }

    const txt = byType.get('TXT');
    const spf = parseSpf(txt?.answers ?? []);
    const parsedDmarc = parseDmarc(dmarc.answers);
    const mx = byType.get('MX');
    const caa = byType.get('CAA');

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: DNS_SCANNER_VERSION,
      checkId: CHECK_IDS.dnsSummary,
      kind: 'tech.indicator',
      state: 'OBSERVED',
      subject: host,
      method: 'dns',
      data: {
        host,
        resolver: ctx.dns.id,
        statuses: {
          A: byType.get('A')?.status ?? 'ERROR',
          AAAA: byType.get('AAAA')?.status ?? 'ERROR',
          MX: mx?.status ?? 'ERROR',
          TXT: txt?.status ?? 'ERROR',
          CAA: caa?.status ?? 'ERROR',
          DMARC: dmarc.status,
        },
        spf: {
          present: spf.present,
          raw: spf.raw,
          allQualifier: spf.allQualifier,
          includeCount: spf.includeCount,
        },
        dmarc: {
          present: parsedDmarc.present,
          raw: parsedDmarc.raw,
          policy: parsedDmarc.policy,
        },
        mx: { present: (mx?.answers.length ?? 0) > 0, count: mx?.answers.length ?? 0 },
        caa: { present: (caa?.answers.length ?? 0) > 0, count: caa?.answers.length ?? 0 },
      },
      provenance: dnsProvenance(ctx, host),
      limitations: [
        'DNS answers depend on the resolver and its cache at query time; TTLs are recorded but not honoured for re-checks.',
        'SPF/DMARC presence is evaluated on the apex and _dmarc names only; subdomain policies are not inspected.',
      ],
    });
  },
};

function addAnswerEvidence(ctx: ScanContext, result: DnsResult, host: string): void {
  const state = result.status === 'ERROR' ? 'ERROR' : 'OBSERVED';
  const limitations =
    result.status === 'NXDOMAIN'
      ? ['The name does not exist according to the resolver — this is an observation, not a failure of the query.']
      : result.status === 'SERVFAIL'
        ? ['The resolver returned SERVFAIL; absence of records cannot be concluded.']
        : result.status === 'ERROR'
          ? ['The DNS query did not complete, so no record claim is made.']
          : ['Answers depend on the resolver and its cache at query time.'];
  const subjectName = result.type === 'TXT' && result.name.startsWith('_dmarc.') ? result.name : host;
  ctx.evidence.add({
    scannerId: SCANNER_ID,
    scannerVersion: DNS_SCANNER_VERSION,
    checkId: CHECK_IDS.dnsAnswer(result.name.startsWith('_dmarc.') ? 'DMARC' : result.type),
    kind: 'tech.indicator',
    state,
    subject: `${subjectName}/${result.type}`,
    method: 'dns',
    data: {
      name: result.name,
      type: result.type,
      status: result.status,
      answers: result.answers.slice(0, 10).map((answer: DnsAnswer) => ({
        data: truncate(answer.data, 300),
        ttl: answer.ttl,
      })),
      answerCount: result.answers.length,
      error: result.error === undefined ? null : { code: result.error.code, message: result.error.message },
    },
    provenance: dnsProvenance(ctx, result.name),
    limitations,
  });
}

function dnsProvenance(ctx: ScanContext, name: string): EvidenceRecord['provenance'] {
  const provenance: EvidenceRecord['provenance'] = {
    source: ctx.source,
    requestedUrl: `dns://${name}`,
  };
  if (ctx.dns.fixtureId !== undefined) provenance.fixtureId = ctx.dns.fixtureId;
  return provenance;
}

export function parseSpf(answers: DnsAnswer[]): ParsedSpf {
  const record = answers.map((answer) => answer.data).find((data) => /^v=spf1(\s|$)/i.test(data.trim()));
  if (record === undefined) {
    return { present: false, raw: null, allQualifier: null, includeCount: 0 };
  }
  const allMatch = /([~+\-?])all\b/i.exec(record);
  return {
    present: true,
    raw: truncate(record, 300),
    allQualifier: allMatch === null ? null : (allMatch[1] ?? null),
    includeCount: (record.match(/\binclude:/gi) ?? []).length,
  };
}

export function parseDmarc(answers: DnsAnswer[]): ParsedDmarc {
  const record = answers.map((answer) => answer.data).find((data) => /^v=DMARC1\b/i.test(data.trim()));
  if (record === undefined) {
    return { present: false, raw: null, policy: null };
  }
  const policy = /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(record)?.[1];
  return {
    present: true,
    raw: truncate(record, 300),
    policy: typeof policy === 'string' ? policy.toLowerCase() : null,
  };
}

export function dnsEvidenceOf(evidence: EvidenceRecord[]): EvidenceRecord | undefined {
  return evidence.find((record) => record.checkId === CHECK_IDS.dnsSummary);
}
