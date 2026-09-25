import type { Clock } from './util/clock';
import type { EvidenceBuilder } from './evidence';
import type { HttpClient } from './transport/client';
import type { NormalizedTarget } from './url-guard';
import type { DnsResolver } from './dns/types';

export interface Limits {
  requestTimeoutMs: number;
  maxRedirects: number;
  maxBodyBytes: number;
  brokenLinkSampleSize: number;
  perRequestDelayMs: number;
  auditBudgetMs: number;
  maxTotalRequests: number;
  maxDnsQueries: number;
}

export const DEFAULT_LIMITS: Limits = {
  requestTimeoutMs: 10_000,
  maxRedirects: 5,
  maxBodyBytes: 524_288,
  brokenLinkSampleSize: 10,
  perRequestDelayMs: 200,
  auditBudgetMs: 45_000,
  maxTotalRequests: 40,
  maxDnsQueries: 6,
};

export interface ScanContext {
  auditId: string;
  target: NormalizedTarget;
  clock: Clock;
  http: HttpClient;
  dns: DnsResolver;
  limits: Limits;
  source: 'live' | 'fixture';
  evidence: EvidenceBuilder;
}

export interface Scanner {
  id: string;
  version: string;
  description: string;
  run(ctx: ScanContext): Promise<void>;
}

export const CHECK_IDS = {
  httpsResponse: 'reachability.https.response',
  httpResponse: 'reachability.http.response',
  httpsReachable: 'tls.https.reachable',
  hsts: 'tls.hsts',
  httpRedirect: 'tls.http-redirect',
  certificate: 'tls.certificate',
  headerSnapshot: 'headers.snapshot',
  headerPresence: (name: string) => `headers.presence.${name}`,
  cookies: 'cookies.flags',
  privacyLinkScan: 'privacy.link.scan',
  privacyLinkPresence: (cls: string) => `privacy.link.presence.${cls}`,
  privacyPageReachability: 'privacy.page.reachability',
  consentIndicator: 'privacy.consent.indicator',
  linkStatus: 'links.status',
  linkSummary: 'links.sample',
  techIndicator: 'tech.indicator',
  techSummary: 'tech.summary',
  a11ySignals: 'a11y.signals',
  dnsAnswer: (type: string) => `dns.answer.${type}`,
  dnsSummary: 'dns.summary',
  securityTxt: 'security.txt.presence',
} as const;
