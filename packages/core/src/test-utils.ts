import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EvidenceBuilder } from './evidence';
import { HttpClient, MemoTransport, type HttpClientOptions } from './transport/client';
import { FixtureTransport } from './transport/fixture';
import type { FixtureBundle } from './transport/fixture-types';
import { FixtureDnsResolver } from './dns/fixture';
import { normalizeTargetInput } from './url-guard';
import { fixedClock } from './util/clock';
import type { ScanContext } from './contracts';
import { DEFAULT_LIMITS } from './contracts';

export const TEST_CLOCK_ISO = '2026-09-21T12:00:00.000Z';
export const TEST_AUDIT_ID = 'audit-test-fixed';

export function loadFixtureBundle(id: string): FixtureBundle {
  const path = fileURLToPath(new URL(`../../../fixtures/${id}/fixture.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as FixtureBundle;
}

export interface TestHarness {
  ctx: ScanContext;
  evidence: EvidenceBuilder;
}

export function createTestHarness(bundle: FixtureBundle): TestHarness {
  const clock = fixedClock(TEST_CLOCK_ISO);
  const transport = new MemoTransport(new FixtureTransport(bundle));
  const options: HttpClientOptions = {
    maxRedirects: DEFAULT_LIMITS.maxRedirects,
    deadlineMs: DEFAULT_LIMITS.auditBudgetMs,
    maxTotalRequests: DEFAULT_LIMITS.maxTotalRequests,
    validateRedirects: true,
  };
  const http = new HttpClient(transport, clock, options);
  const targetResult = normalizeTargetInput(bundle.target);
  if (!targetResult.ok) {
    throw new Error(`Fixture target is not allowed by the URL guard: ${bundle.target}`);
  }
  const evidence = new EvidenceBuilder(TEST_AUDIT_ID, clock);
  const ctx: ScanContext = {
    auditId: TEST_AUDIT_ID,
    target: targetResult.target,
    clock,
    http,
    dns: new FixtureDnsResolver(bundle.dns ?? [], bundle.id),
    limits: { ...DEFAULT_LIMITS, perRequestDelayMs: 0 },
    source: 'fixture',
    evidence,
  };
  return { ctx, evidence };
}

export function fixtureAuditOptions(id: string) {
  const bundle = loadFixtureBundle(id);
  return {
    target: bundle.target,
    transport: new FixtureTransport(bundle),
    dnsResolver: new FixtureDnsResolver(bundle.dns ?? [], bundle.id),
    clock: fixedClock(TEST_CLOCK_ISO),
    auditId: TEST_AUDIT_ID,
    source: 'fixture' as const,
    limits: { perRequestDelayMs: 0 },
  };
}
