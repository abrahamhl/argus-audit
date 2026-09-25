import type { DnsAnswer, DnsRecordType, DnsResolver, DnsResult, DnsStatus } from './types';

interface DohResponse {
  Status?: number;
  Answer?: { name?: string; type?: number; TTL?: number; data?: string }[];
}

const TYPE_NUMBERS: Record<DnsRecordType, number> = {
  A: 1,
  AAAA: 28,
  MX: 15,
  TXT: 16,
  CAA: 257,
  NS: 2,
};

const STATUS_BY_CODE: Record<number, DnsStatus> = {
  0: 'OK',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
};

export interface DohResolverOptions {
  endpoint?: string;
  timeoutMs?: number;
}

/**
 * DNS-over-HTTPS resolver (RFC 8484 JSON API). Works in Workers and Node 22
 * because it only needs `fetch`. Passive: queries public DNS records only.
 */
export class DohResolver implements DnsResolver {
  readonly id: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: DohResolverOptions = {}) {
    this.endpoint = options.endpoint ?? 'https://cloudflare-dns.com/dns-query';
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.id = `doh:${new URL(this.endpoint).hostname}`;
  }

  async resolve(name: string, type: DnsRecordType): Promise<DnsResult> {
    const url = `${this.endpoint}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        return {
          name,
          type,
          status: 'ERROR',
          answers: [],
          error: { code: `HTTP_${response.status}`, message: `DNS endpoint returned HTTP ${response.status}` },
        };
      }
      const body = (await response.json()) as DohResponse;
      const status = STATUS_BY_CODE[body.Status ?? -1] ?? 'ERROR';
      const answers: DnsAnswer[] = (body.Answer ?? [])
        .filter((answer) => answer.type === TYPE_NUMBERS[type] && typeof answer.data === 'string')
        .map((answer) => ({ data: cleanData(answer.data ?? ''), ttl: answer.TTL ?? 0 }));
      return { name, type, status, answers };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      return {
        name,
        type,
        status: 'ERROR',
        answers: [],
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout ? `DNS query exceeded ${this.timeoutMs} ms` : 'DNS query failed',
        },
      };
    }
  }
}

function cleanData(data: string): string {
  const trimmed = data.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
