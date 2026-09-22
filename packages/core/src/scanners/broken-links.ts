import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import { getHomepageHtml } from './shared';
import { extractPageSignals } from '../util/html';
import { sleep } from '../util/clock';
import type { HttpExchange } from '../transport/client';

export const LINKS_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'links.broken';

export const brokenLinksScanner: Scanner = {
  id: SCANNER_ID,
  version: LINKS_SCANNER_VERSION,
  description:
    'Bounded sample of internal links from the delivered homepage, checked with HEAD and confirmed with GET when needed. Sequential, delayed, hard-capped.',
  async run(ctx: ScanContext): Promise<void> {
    const home = await getHomepageHtml(ctx);
    if (home.html === null) {
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: LINKS_SCANNER_VERSION,
        checkId: CHECK_IDS.linkSummary,
        kind: 'link.status',
        state: home.reason === 'error' ? 'ERROR' : 'NOT_CHECKED',
        subject: home.exchange.finalUrl,
        method: 'html-scan',
        data: { reason: home.reason, sampled: 0, checked: 0, broken: 0, inconclusive: 0 },
        provenance: provenanceFromExchange(home.exchange),
        limitations: ['The homepage HTML could not be scanned, so no links were sampled.'],
      });
      return;
    }

    const signals = extractPageSignals(home.html, home.exchange.finalUrl);
    const candidates = sampleLinks(signals.links, ctx.limits.brokenLinkSampleSize);

    let broken = 0;
    let inconclusive = 0;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate === undefined) continue;
      if (index > 0) await sleep(ctx.limits.perRequestDelayMs);

      const result = await checkLink(ctx, candidate.url);
      if (result.broken) broken += 1;
      if (result.inconclusive) inconclusive += 1;

      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: LINKS_SCANNER_VERSION,
        checkId: CHECK_IDS.linkStatus,
        kind: 'link.status',
        state: result.errorCode === null ? 'OBSERVED' : 'ERROR',
        subject: candidate.url,
        method: result.method,
        data: {
          url: candidate.url,
          path: candidate.pathKey,
          method: result.method,
          status: result.status,
          finalUrl: result.finalUrl,
          broken: result.broken,
          inconclusive: result.inconclusive,
          error: result.errorCode === null ? null : { code: result.errorCode, message: result.errorMessage },
        },
        provenance: provenanceFromExchange(result.exchange),
        limitations: [
          'HEAD/GET status is a point-in-time observation. Soft-404 pages that return 200 cannot be detected this way.',
        ],
      });
    }

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: LINKS_SCANNER_VERSION,
      checkId: CHECK_IDS.linkSummary,
      kind: 'link.status',
      state: 'OBSERVED',
      subject: home.exchange.finalUrl,
      method: 'sample',
      data: {
        sampled: candidates.length,
        checked: candidates.length,
        broken,
        inconclusive,
        sampleSizeLimit: ctx.limits.brokenLinkSampleSize,
      },
      provenance: provenanceFromExchange(home.exchange),
      limitations: [
        'Only a bounded sample of internal, non-legal links from the homepage is checked.',
        'Rate-limited responses (HTTP 429) are counted as inconclusive, never as broken.',
      ],
    });
  },
};

interface LinkCandidate {
  url: string;
  pathKey: string;
}

export function sampleLinks(
  links: { kind: string; resolved: string | null; legalClass: string | null }[],
  limit: number,
): LinkCandidate[] {
  const seen = new Set<string>();
  const candidates: LinkCandidate[] = [];

  for (const link of links) {
    if (link.kind !== 'internal' || link.resolved === null) continue;
    // Policy pages are excluded: the privacy page is fetched by the privacy
    // scanner, and terms/legal pages are deliberately out of this sample.
    if (link.legalClass === 'privacy' || link.legalClass === 'terms' || link.legalClass === 'legal') {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(link.resolved);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') continue;
    const pathKey = `${parsed.hostname}${path}${parsed.search}`;
    if (seen.has(pathKey)) continue;
    seen.add(pathKey);
    candidates.push({ url: parsed.href, pathKey });
    if (candidates.length >= limit) break;
  }

  return candidates;
}

interface LinkCheckResult {
  method: 'HEAD' | 'GET';
  status: number;
  finalUrl: string;
  broken: boolean;
  inconclusive: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  exchange: HttpExchange;
}

async function checkLink(ctx: ScanContext, url: string): Promise<LinkCheckResult> {
  let method: 'HEAD' | 'GET' = 'HEAD';
  let exchange = await ctx.http.request(url, { method: 'HEAD' });

  const headUnhelpful =
    exchange.error !== undefined ||
    exchange.status === 405 ||
    exchange.status === 501 ||
    (exchange.status >= 400 && exchange.status !== 429);

  if (headUnhelpful) {
    method = 'GET';
    exchange = await ctx.http.request(url, { method: 'GET' });
  }

  if (exchange.error !== undefined) {
    return {
      method,
      status: 0,
      finalUrl: exchange.finalUrl,
      broken: false,
      inconclusive: true,
      errorCode: exchange.error.code,
      errorMessage: exchange.error.message,
      exchange,
    };
  }

  const status = exchange.status;
  return {
    method,
    status,
    finalUrl: exchange.finalUrl,
    broken: status >= 400 && status !== 429,
    inconclusive: status === 429,
    errorCode: null,
    errorMessage: null,
    exchange,
  };
}
