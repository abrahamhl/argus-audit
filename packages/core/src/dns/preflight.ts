import { checkHostname } from '../url-guard';
import type { DnsRecordType, DnsResolver, DnsResult } from './types';

/**
 * Wraps a resolver so each (name, type) is asked once per audit. The pre-flight A/AAAA lookups are then
 * reused by the DNS scanner, keeping the documented per-audit query budget unchanged.
 */
export function memoizeResolver(inner: DnsResolver): DnsResolver {
  const cache = new Map<string, Promise<DnsResult>>();
  return {
    id: inner.id,
    ...(inner.fixtureId !== undefined ? { fixtureId: inner.fixtureId } : {}),
    resolve(name: string, type: DnsRecordType) {
      const key = `${name.toLowerCase().replace(/\.$/, '')}|${type}`;
      let hit = cache.get(key);
      if (!hit) {
        hit = inner.resolve(name, type);
        cache.set(key, hit);
      }
      return hit;
    },
  };
}

/**
 * A public name can still point at a private address ("127.0.0.1.nip.io", internal split-horizon records).
 * Returns the first reserved address the target resolves to, or null. Unanswered lookups are not treated as
 * private: the literal-address guard already ran, and resolution failures surface later as evidence.
 * A rebinding window between this check and the fetch remains (see docs/THREAT_MODEL.md T1).
 */
export async function findPrivateResolution(resolver: DnsResolver, hostname: string): Promise<string | null> {
  for (const type of ['A', 'AAAA'] as const) {
    const result = await resolver.resolve(hostname, type);
    if (result.status !== 'OK') continue;
    for (const answer of result.answers) {
      const ip = answer.data.trim();
      if ((type === 'A' && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) || (type === 'AAAA' && ip.includes(':'))) {
        if (!checkHostname(ip).allowed) return ip;
      }
    }
  }
  return null;
}
