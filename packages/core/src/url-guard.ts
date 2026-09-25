export interface NormalizedTarget {
  /** What the user typed, unmodified. */
  input: string;
  hostname: string;
  httpsUrl: string;
  httpUrl: string;
}

export interface TargetRejection {
  code: string;
  message: string;
}

export type TargetResult = { ok: true; target: NormalizedTarget } | ({ ok: false } & TargetRejection);

const DENIED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.onion',
  '.i2p',
  '.test-ipv6.local',
];

const DENIED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Fail-closed SSRF guard for audit targets and redirect hops.
 *
 * This is deliberately conservative: single-label hostnames, credentials,
 * non-HTTP schemes and any literal address in a private/reserved range are
 * rejected. Cloudflare Workers cannot pin DNS, so a rebinding/TOCTOU window
 * remains documented in docs/THREAT_MODEL.md.
 */
export function normalizeTargetInput(raw: string): TargetResult {
  const input = raw.trim();
  if (input.length === 0) {
    return { ok: false, code: 'EMPTY', message: 'Enter a website address.' };
  }
  if (input.length > 2048) {
    return { ok: false, code: 'TOO_LONG', message: 'Address is too long.' };
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, code: 'INVALID_URL', message: 'This does not look like a valid website address.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, code: 'SCHEME_NOT_ALLOWED', message: 'Only http:// and https:// addresses can be audited.' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, code: 'CREDENTIALS_NOT_ALLOWED', message: 'Addresses with embedded credentials are not accepted.' };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, code: 'PORT_NOT_ALLOWED', message: 'Only ports 80 and 443 are accepted.' };
  }

  const hostCheck = checkHostname(url.hostname);
  if (!hostCheck.allowed) {
    return { ok: false, code: hostCheck.code, message: hostCheck.message };
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  return {
    ok: true,
    target: {
      input,
      hostname,
      httpsUrl: `https://${hostname}/`,
      httpUrl: `http://${hostname}/`,
    },
  };
}

export function isAllowedRedirectUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username !== '' || url.password !== '') return false;
  if (!ALLOWED_PORTS.has(url.port)) return false;
  return checkHostname(url.hostname).allowed;
}

export function checkHostname(hostnameRaw: string): { allowed: boolean; code: string; message: string } {
  // A single trailing dot is the same DNS name ("localhost." is localhost).
  const hostname = hostnameRaw.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');

  if (hostname.length === 0 || hostname.length > 253) {
    return denied('INVALID_HOST', 'Invalid hostname.');
  }
  if (DENIED_HOSTS.has(hostname)) {
    return denied('PRIVATE_HOST', 'Local and internal addresses are not auditable.');
  }
  for (const suffix of DENIED_HOST_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return denied('PRIVATE_HOST', 'Local and internal addresses are not auditable.');
    }
  }
  if (hostname.includes(':')) {
    return checkIpv6(hostname);
  }
  if (hostname.includes('.')) {
    const ipv4 = parseIpv4(hostname);
    if (ipv4 !== null) {
      if (isReservedIpv4(ipv4)) {
        return denied('PRIVATE_IP', 'Private, reserved and loopback addresses are not auditable.');
      }
      return { allowed: true, code: 'OK', message: '' };
    }
    return { allowed: true, code: 'OK', message: '' };
  }
  return denied('SINGLE_LABEL_HOST', 'Internal hostnames are not auditable. Use a public domain name.');
}

function denied(code: string, message: string): { allowed: false; code: string; message: string } {
  return { allowed: false, code, message };
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    numbers.push(value);
  }
  return numbers;
}

function isReservedIpv4(ip: number[]): boolean {
  const [a = 0, b = 0, c = 0] = ip;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

/** Expands an IPv6 literal (as produced by the URL parser, dotted tail allowed) into 8 hextets. */
function parseIpv6(host: string): number[] | null {
  let text = host;
  const tail: number[] = [];
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (dotted?.[1]) {
    const v4 = parseIpv4(dotted[1]);
    if (v4 === null) return null;
    tail.push(((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0));
    text = text.slice(0, -dotted[1].length);
    if (text.endsWith(':') && !text.endsWith('::')) text = text.slice(0, -1);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string | undefined): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];
    for (const g of part.split(':')) {
      if (g === '') continue;
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };
  const head = toGroups(halves[0]);
  const rest = toGroups(halves[1]);
  if (head === null || rest === null) return null;
  const known = head.length + rest.length + tail.length;
  if (halves.length === 1 && known !== 8) return null;
  if (known > 8) return null;
  const zeros = new Array<number>(8 - known).fill(0);
  return [...head, ...zeros, ...rest, ...tail];
}

function ipv4FromGroups(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function checkIpv6(host: string): { allowed: boolean; code: string; message: string } {
  const deny = () => denied('PRIVATE_IP', 'Private, reserved and loopback addresses are not auditable.');
  const g = parseIpv6(host);
  if (g === null) return denied('INVALID_HOST', 'Invalid hostname.');
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  const firstSixZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0;

  // ::, ::1 and IPv4-compatible ::a.b.c.d (deprecated, always refused).
  if (firstSixZero) return deny();
  // IPv4-mapped ::ffff:a.b.c.d — the URL parser writes it as ::ffff:7f00:1.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isReservedIpv4(ipv4FromGroups(g6, g7)) ? deny() : { allowed: true, code: 'OK', message: '' };
  }
  // NAT64 (64:ff9b::/96, 64:ff9b:1::/48) and 6to4 (2002::/16) embed an IPv4 address.
  if (g0 === 0x64 && g1 === 0xff9b) {
    if (g2 === 1 || isReservedIpv4(ipv4FromGroups(g6, g7))) return deny();
  }
  if (g0 === 0x2002 && isReservedIpv4(ipv4FromGroups(g1, g2))) return deny();
  // Teredo (2001::/32) hides an obfuscated IPv4; documentation range 2001:db8::/32.
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) return deny();
  // Unique local fc00::/7, link-local fe80::/10, multicast ff00::/8.
  if ((g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xff00) === 0xff00) return deny();
  return { allowed: true, code: 'OK', message: '' };
}
