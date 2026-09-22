import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import { truncate } from '../util/hash';
import type { FindingCategory, Severity } from '../finding';
import type { JsonValue } from '../evidence';

export const HEADERS_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'headers.security';

export interface HeaderSpec {
  name: string;
  label: string;
  severityIfMissing: Severity;
  category: FindingCategory;
  whyItMatters: string;
  howToFix: string;
  standards: string[];
}

export const HEADER_SPECS: HeaderSpec[] = [
  {
    name: 'content-security-policy',
    label: 'Content-Security-Policy',
    severityIfMissing: 'review',
    category: 'security-headers',
    whyItMatters:
      'CSP is a defence-in-depth control that can limit which scripts, styles and frames a browser will trust on the page. Its absence does not by itself mean the site is exploitable; it means one common layer of mitigation is not observable.',
    howToFix:
      'Define a Content-Security-Policy that matches the assets the site actually loads. Start in report-only mode, review violations, then enforce.',
    standards: ['OWASP Secure Headers Project — Content-Security-Policy'],
  },
  {
    name: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    severityIfMissing: 'informational',
    category: 'security-headers',
    whyItMatters:
      'The nosniff directive tells browsers not to reinterpret a response as a different content type, closing a class of content-sniffing attacks.',
    howToFix: 'Add the header `X-Content-Type-Options: nosniff` to responses.',
    standards: ['WHATWG Fetch — X-Content-Type-Options'],
  },
  {
    name: 'referrer-policy',
    label: 'Referrer-Policy',
    severityIfMissing: 'informational',
    category: 'security-headers',
    whyItMatters:
      'Referrer-Policy controls how much URL information is sent to other origins when users follow links. A default policy can leak paths or query strings.',
    howToFix:
      'Set a deliberate policy such as `Referrer-Policy: strict-origin-when-cross-origin` (or stricter) and verify outbound analytics still work.',
    standards: ['W3C Referrer Policy'],
  },
  {
    name: 'permissions-policy',
    label: 'Permissions-Policy',
    severityIfMissing: 'informational',
    category: 'security-headers',
    whyItMatters:
      'Permissions-Policy lets the site switch off browser features it does not use (camera, microphone, geolocation), reducing the impact of injected third-party code.',
    howToFix:
      'Declare a baseline policy that disables unused features, for example `Permissions-Policy: camera=(), microphone=(), geolocation=()`.',
    standards: ['W3C Permissions Policy'],
  },
];

export const FRAME_PROTECTION_HEADER = 'x-frame-options';

export const securityHeadersScanner: Scanner = {
  id: SCANNER_ID,
  version: HEADERS_SCANNER_VERSION,
  description:
    'Presence and value of common security-response headers, observed in the HTTPS response to the site root. Cookies flags summary (no values, no names).',
  async run(ctx: ScanContext): Promise<void> {
    const https = await ctx.http.request(ctx.target.httpsUrl, { method: 'GET' });
    const source = https.source;
    const baseProvenance = provenanceFromExchange(https);

    if (https.error !== undefined) {
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: HEADERS_SCANNER_VERSION,
        checkId: CHECK_IDS.headerSnapshot,
        kind: 'header.presence',
        state: 'ERROR',
        subject: ctx.target.httpsUrl,
        method: 'GET',
        data: {
          reason: 'no-response',
          error: { code: https.error.code, message: https.error.message },
        },
        provenance: baseProvenance,
        limitations: ['No response was received, so no header presence could be determined.'],
      });
      return;
    }

    const names = Object.keys(https.headers).sort();

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: HEADERS_SCANNER_VERSION,
      checkId: CHECK_IDS.headerSnapshot,
      kind: 'header.presence',
      state: 'OBSERVED',
      subject: ctx.target.httpsUrl,
      method: 'GET',
      data: {
        status: https.status,
        finalUrl: https.finalUrl,
        headerNames: names,
        headerCount: names.length,
      },
      provenance: baseProvenance,
      limitations: [
        'Only the response to one request is inspected; some headers are set per-route or per-asset.',
      ],
    });

    for (const spec of HEADER_SPECS) {
      const value = https.headers[spec.name] ?? null;
      ctx.evidence.add({
        scannerId: SCANNER_ID,
        scannerVersion: HEADERS_SCANNER_VERSION,
        checkId: CHECK_IDS.headerPresence(spec.name),
        kind: 'header.presence',
        state: 'OBSERVED',
        subject: spec.name,
        method: 'GET',
        data: {
          header: spec.name,
          label: spec.label,
          present: value !== null,
          value: value === null ? null : truncate(value, 300),
        },
        provenance: baseProvenance,
        limitations: ['Presence is observed for the site root only.'],
      });
    }

    const frameValue = https.headers[FRAME_PROTECTION_HEADER] ?? null;
    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: HEADERS_SCANNER_VERSION,
      checkId: CHECK_IDS.headerPresence(FRAME_PROTECTION_HEADER),
      kind: 'header.presence',
      state: 'OBSERVED',
      subject: FRAME_PROTECTION_HEADER,
      method: 'GET',
      data: {
        header: FRAME_PROTECTION_HEADER,
        label: 'X-Frame-Options',
        present: frameValue !== null,
        value: frameValue === null ? null : truncate(frameValue, 300),
      },
      provenance: baseProvenance,
      limitations: [
        'A Content-Security-Policy frame-ancestors directive also protects against framing; the rule for this check takes that into account.',
      ],
    });

    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: HEADERS_SCANNER_VERSION,
      checkId: CHECK_IDS.cookies,
      kind: 'cookie.flags',
      state: 'OBSERVED',
      subject: 'set-cookie',
      method: 'GET',
      data: cookieFlagSummary(https.setCookie ?? []),
      provenance: baseProvenance,
      limitations: [
        'Only cookies set on the site-root response are inspected. Cookie names and values are deliberately not stored.',
      ],
    });

    void source;
  },
};

export function cookieFlagSummary(setCookie: string[]): JsonValue {
  let withoutSecure = 0;
  let withoutHttpOnly = 0;
  let withoutSameSite = 0;
  const sameSiteValues: string[] = [];

  for (const raw of setCookie) {
    const flags = raw.toLowerCase();
    if (!/(^|;)\s*secure\s*(;|$)/.test(flags)) withoutSecure += 1;
    if (!/(^|;)\s*httponly\s*(;|$)/.test(flags)) withoutHttpOnly += 1;
    const sameSite = /samesite\s*=\s*([a-z]+)/.exec(flags);
    if (sameSite === null) {
      withoutSameSite += 1;
    } else {
      sameSiteValues.push(sameSite[1] ?? 'unknown');
    }
  }

  return {
    cookieCount: setCookie.length,
    withoutSecure,
    withoutHttpOnly,
    withoutSameSite,
    sameSiteValues,
  };
}
