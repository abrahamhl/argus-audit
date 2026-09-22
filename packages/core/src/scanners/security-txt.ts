import type { Scanner, ScanContext } from '../contracts';
import { CHECK_IDS } from '../contracts';
import { provenanceFromExchange } from '../evidence-provenance';
import { truncate } from '../util/hash';
import type { HttpExchange } from '../transport/client';

export const SECURITY_TXT_SCANNER_VERSION = '1.0.0';

const SCANNER_ID = 'security.txt.check';

const PATHS = ['/.well-known/security.txt', '/security.txt'];

export interface SecurityTxtFields {
  contact: string[];
  expires: string | null;
  canonical: string | null;
  policy: string | null;
  preferredLanguages: string | null;
}

export const securityTxtScanner: Scanner = {
  id: SCANNER_ID,
  version: SECURITY_TXT_SCANNER_VERSION,
  description:
    'RFC 9116 security.txt lookup at /.well-known/security.txt and /security.txt, with Contact and Expires fields parsed. Two bounded requests at most.',
  async run(ctx: ScanContext): Promise<void> {
    let found: { exchange: HttpExchange; fields: SecurityTxtFields; expired: boolean } | null = null;
    let last: HttpExchange | null = null;

    for (const path of PATHS) {
      const exchange = await ctx.http.request(new URL(path, ctx.target.httpsUrl).href, { method: 'GET' });
      last = exchange;
      if (exchange.error === undefined && exchange.status >= 200 && exchange.status < 300 && exchange.bodyText !== undefined) {
        const fields = parseSecurityTxt(exchange.bodyText);
        found = {
          exchange,
          fields,
          expired: fields.expires !== null && Date.parse(fields.expires) < ctx.clock.nowMs(),
        };
        break;
      }
      if (exchange.error !== undefined) break;
    }

    const reference = found?.exchange ?? last;
    if (reference === null) return;

    const state = reference.error !== undefined ? 'ERROR' : 'OBSERVED';
    ctx.evidence.add({
      scannerId: SCANNER_ID,
      scannerVersion: SECURITY_TXT_SCANNER_VERSION,
      checkId: CHECK_IDS.securityTxt,
      kind: 'page.presence',
      state,
      subject: 'security.txt',
      method: 'GET',
      data: {
        found: found !== null,
        url: found === null ? null : found.exchange.finalUrl,
        status: found === null ? reference.status : found.exchange.status,
        contactCount: found?.fields.contact.length ?? 0,
        expires: found?.fields.expires === null || found === null ? null : found.fields.expires,
        expired: found === null ? null : found.expired,
        policy: found?.fields.policy === null || found === null ? null : found.fields.policy,
        error: reference.error === undefined ? null : { code: reference.error.code, message: reference.error.message },
      },
      provenance: provenanceFromExchange(reference),
      limitations: [
        'Only the two standard paths are checked; a security.txt served under another name is not seen.',
        'Contact addresses are recorded as counts and expiry only — no addresses are stored in evidence.',
      ],
    });
  },
};

export function parseSecurityTxt(body: string): SecurityTxtFields {
  const contact: string[] = [];
  let expires: string | null = null;
  let canonical: string | null = null;
  let policy: string | null = null;
  let preferredLanguages: string | null = null;

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z-]+)\s*:\s*(.+)$/.exec(trimmed);
    if (match === null) continue;
    const key = (match[1] ?? '').toLowerCase();
    const value = truncate((match[2] ?? '').trim(), 300);
    switch (key) {
      case 'contact':
        contact.push(value);
        break;
      case 'expires':
        expires = value;
        break;
      case 'canonical':
        canonical = value;
        break;
      case 'policy':
        policy = value;
        break;
      case 'preferred-languages':
        preferredLanguages = value;
        break;
      default:
        break;
    }
  }

  return { contact, expires, canonical, policy, preferredLanguages };
}
