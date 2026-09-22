import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import { truncate } from '../util/hash';

export const TRANSPORT_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'tls.transport';

export const transportSecurityScanner: Scanner = {
  id: SCANNER_ID,
  version: TRANSPORT_SCANNER_VERSION,
  description:
    'Transport-security indicators observable through a fetch: HTTPS reachability, HSTS header, HTTP→HTTPS redirect. Certificates are explicitly NOT_CHECKED.',
  async run(ctx: ScanContext): Promise<void> {
    const https = await ctx.http.request(ctx.target.httpsUrl, { method: 'GET' });
    const http = await ctx.http.request(ctx.target.httpUrl, { method: 'GET' });

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TRANSPORT_SCANNER_VERSION,
      checkId: CHECK_IDS.httpsReachable,
      kind: 'tls.indicator',
      state: https.error !== undefined ? 'ERROR' : 'OBSERVED',
      subject: ctx.target.httpsUrl,
      method: 'GET',
      data: {
        reachable: https.error === undefined && https.status > 0,
        status: https.status,
        finalUrl: https.finalUrl,
        error: https.error === undefined ? null : { code: https.error.code, message: https.error.message },
      },
      provenance: provenanceFromExchange(https),
      limitations: [
        'Reachability was tested from one network location at one point in time; it is not an availability guarantee.',
      ],
    });

    const hsts = https.headers['strict-transport-security'] ?? null;
    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TRANSPORT_SCANNER_VERSION,
      checkId: CHECK_IDS.hsts,
      kind: 'tls.indicator',
      state: https.error !== undefined ? 'ERROR' : 'OBSERVED',
      subject: 'strict-transport-security',
      method: 'GET',
      data: {
        present: hsts !== null,
        value: hsts === null ? null : truncate(hsts, 300),
        maxAgeSeconds: parseMaxAge(hsts),
        includeSubDomains: hsts === null ? null : /includesubdomains/i.test(hsts),
      },
      provenance: provenanceFromExchange(https),
      limitations:
        https.error === undefined
          ? ['Absence is observed in one response to the site root; other paths may differ.']
          : ['No response was available, so header presence could not be determined.'],
    });

    const upgraded = http.error === undefined && new URL(http.finalUrl).protocol === 'https:';
    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TRANSPORT_SCANNER_VERSION,
      checkId: CHECK_IDS.httpRedirect,
      kind: 'tls.indicator',
      state: http.error !== undefined ? 'ERROR' : 'OBSERVED',
      subject: ctx.target.httpUrl,
      method: 'GET',
      data: {
        upgradedToHttps: upgraded,
        status: http.status,
        finalUrl: http.finalUrl,
        redirectHops: http.redirects.length,
        error: http.error === undefined ? null : { code: http.error.code, message: http.error.message },
      },
      provenance: provenanceFromExchange(http),
      limitations: [
        'A single plain-HTTP request; other paths or cached responses may behave differently.',
      ],
    });

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: TRANSPORT_SCANNER_VERSION,
      checkId: CHECK_IDS.certificate,
      kind: 'tls.indicator',
      state: 'NOT_CHECKED',
      subject: 'tls-certificate',
      method: 'none',
      data: {
        reason: 'runtime-does-not-expose-certificate',
        detail:
          'The execution runtime used for passive audits does not expose the peer certificate chain, issuer or expiry.',
      },
      provenance: provenanceFromExchange(https),
      limitations: [
        'Certificate chain, issuer, key type and expiry were not inspected. Use a purpose-built TLS inspection tool for that.',
      ],
    });
  },
};

function parseMaxAge(value: string | null): number | null {
  if (value === null) return null;
  const match = /max-age\s*=\s*(\d+)/i.exec(value);
  if (match === null) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
