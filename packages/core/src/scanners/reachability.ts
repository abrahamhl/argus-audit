import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import type { HttpExchange } from '../transport/client';
import type { JsonValue } from '../evidence';

export const REACHABILITY_SCANNER_VERSION = '1.0.0';

export const reachabilityScanner: Scanner = {
  id: 'http.reachability',
  version: REACHABILITY_SCANNER_VERSION,
  description:
    'Reachability over HTTPS and HTTP with the full redirect chain. One GET per scheme, redirects followed manually.',
  async run(ctx: ScanContext): Promise<void> {
    const https = await ctx.http.request(ctx.target.httpsUrl, { method: 'GET' });
    addResponseEvidence(ctx, https, CHECK_IDS.httpsResponse, ctx.target.httpsUrl);

    const http = await ctx.http.request(ctx.target.httpUrl, { method: 'GET' });
    addResponseEvidence(ctx, http, CHECK_IDS.httpResponse, ctx.target.httpUrl);
  },
};

function addResponseEvidence(ctx: ScanContext, exchange: HttpExchange, checkId: string, requested: string): void {
  const limitations: string[] = [
    'A single request to the site root from one network location. Other paths, user agents or networks may produce different results.',
  ];
  if (exchange.error !== undefined) {
    limitations.push(`Request failed: ${exchange.error.code} — ${exchange.error.message}`);
  }
  ctx.evidence.add({
    scannerId: reachabilityScanner.id,
    scannerVersion: REACHABILITY_SCANNER_VERSION,
    checkId,
    kind: 'http.response',
    state: exchange.error !== undefined ? 'ERROR' : 'OBSERVED',
    subject: requested,
    method: 'GET',
    data: responseData(exchange),
    provenance: provenanceFromExchange(exchange),
    limitations,
  });
}

function responseData(exchange: HttpExchange): JsonValue {
  return {
    status: exchange.status,
    finalUrl: exchange.finalUrl,
    contentType: exchange.headers['content-type'] ?? null,
    server: exchange.headers['server'] ?? null,
    redirects: exchange.redirects.map((hop) => ({
      url: hop.url,
      status: hop.status,
      location: hop.location,
    })),
    durationMs: exchange.durationMs,
    bodyBytes: exchange.bodyBytes ?? null,
    bodyTruncated: exchange.bodyTruncated ?? null,
    error: exchange.error === undefined ? null : { code: exchange.error.code, message: exchange.error.message },
  };
}
