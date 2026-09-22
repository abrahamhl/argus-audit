export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CAA' | 'NS';

export type DnsStatus = 'OK' | 'NXDOMAIN' | 'SERVFAIL' | 'ERROR';

export interface DnsAnswer {
  data: string;
  ttl: number;
}

export interface DnsResult {
  name: string;
  type: DnsRecordType;
  status: DnsStatus;
  answers: DnsAnswer[];
  error?: { code: string; message: string };
}

export interface DnsResolver {
  id: string;
  /** Set when answers come from a recorded fixture bundle. */
  fixtureId?: string;
  resolve(name: string, type: DnsRecordType): Promise<DnsResult>;
}

/** Recorded DNS entry used by the fixture resolver. */
export interface FixtureDnsEntry {
  name: string;
  type: DnsRecordType;
  status: DnsStatus;
  answers?: { data: string; ttl?: number }[];
  error?: { code: string; message: string };
}

/** Resolver used when none is configured: produces explicit ERROR evidence. */
export const unavailableDnsResolver: DnsResolver = {
  id: 'unavailable',
  async resolve(name, type) {
    return {
      name,
      type,
      status: 'ERROR',
      answers: [],
      error: { code: 'NO_RESOLVER', message: 'No DNS resolver was configured for this audit.' },
    };
  },
};
