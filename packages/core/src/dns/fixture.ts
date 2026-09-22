import type { DnsRecordType, DnsResolver, DnsResult, FixtureDnsEntry } from './types';

/** Replays recorded DNS answers: deterministic and fully offline. */
export class FixtureDnsResolver implements DnsResolver {
  readonly id = 'fixture-dns';
  readonly fixtureId?: string;
  private readonly entries = new Map<string, FixtureDnsEntry>();

  constructor(
    entries: FixtureDnsEntry[],
    fixtureId?: string,
  ) {
    if (fixtureId !== undefined) this.fixtureId = fixtureId;
    for (const entry of entries) {
      this.entries.set(this.key(entry.name, entry.type), entry);
    }
  }

  async resolve(name: string, type: DnsRecordType): Promise<DnsResult> {
    const entry = this.entries.get(this.key(name, type));
    if (entry === undefined) {
      return { name, type, status: 'ERROR', answers: [], error: { code: 'NOT_IN_FIXTURE', message: 'No recorded DNS answer' } };
    }
    const result: DnsResult = {
      name,
      type,
      status: entry.status,
      answers: (entry.answers ?? []).map((answer) => ({ data: answer.data, ttl: answer.ttl ?? 300 })),
    };
    if (entry.error !== undefined) result.error = entry.error;
    return result;
  }

  private key(name: string, type: DnsRecordType): string {
    return `${type} ${name.toLowerCase()}`;
  }
}
