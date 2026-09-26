import { describe, expect, it } from 'vitest';
import { runAudit } from '../audit';
import { FixtureTransport } from '../transport/fixture';
import { findPrivateResolution, memoizeResolver } from './preflight';
import type { DnsRecordType, DnsResolver } from './types';

function resolverFor(records: Partial<Record<DnsRecordType, string[]>>, calls: string[] = []): DnsResolver {
  return {
    id: 'test',
    async resolve(name, type) {
      calls.push(`${name}|${type}`);
      const data = records[type];
      return data
        ? { name, type, status: 'OK', answers: data.map((d) => ({ data: d, ttl: 60 })) }
        : { name, type, status: 'NXDOMAIN', answers: [] };
    },
  };
}

describe('DNS pre-flight', () => {
  it.each([
    [{ A: ['127.0.0.1'] }, '127.0.0.1'],
    [{ A: ['93.184.215.14', '10.0.0.5'] }, '10.0.0.5'],
    [{ A: ['169.254.169.254'] }, '169.254.169.254'],
    [{ AAAA: ['::1'] }, '::1'],
    [{ AAAA: ['fd12:3456::1'] }, 'fd12:3456::1'],
  ])('flags a public name that resolves privately (%j)', async (records, ip) => {
    expect(await findPrivateResolution(resolverFor(records), 'rebind.example')).toBe(ip);
  });

  it('accepts public answers and unanswered lookups', async () => {
    expect(await findPrivateResolution(resolverFor({ A: ['93.184.215.14'], AAAA: ['2606:2800:21f::1'] }), 'example.com')).toBeNull();
    expect(await findPrivateResolution(resolverFor({}), 'example.com')).toBeNull();
  });

  it('memoizes so the DNS scanner reuses the pre-flight answers', async () => {
    const calls: string[] = [];
    const dns = memoizeResolver(resolverFor({ A: ['93.184.215.14'] }, calls));
    await dns.resolve('example.com', 'A');
    await dns.resolve('EXAMPLE.com.', 'A');
    expect(calls).toEqual(['example.com|A']);
  });

  it('runAudit refuses a target that resolves to a private address before any HTTP request', async () => {
    const transport = new FixtureTransport({
      id: 'x',
      name: 'x',
      target: 'https://127.0.0.1.nip.io/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [],
    });
    await expect(
      runAudit({ target: '127.0.0.1.nip.io', transport, dnsResolver: resolverFor({ A: ['127.0.0.1'] }) }),
    ).rejects.toMatchObject({ code: 'PRIVATE_RESOLUTION' });
  });
});
