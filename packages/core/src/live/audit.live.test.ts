import { describe, expect, it } from 'vitest';
import { runAudit } from '../audit';
import { LiveTransport } from '../transport/live';
import { DEFAULT_LIMITS } from '../contracts';

/**
 * Live network test — intentionally excluded from deterministic CI.
 * Run manually:  LIVE_AUDIT_TARGET=https://example.com pnpm test:live
 */
const target = process.env['LIVE_AUDIT_TARGET'];

describe.skipIf(target === undefined || target === '')('live audit (network)', () => {
  it('runs a full passive audit and produces reports with evidence', async () => {
    const result = await runAudit({
      target: target ?? '',
      transport: new LiveTransport({ requestTimeoutMs: 10_000, maxBodyBytes: DEFAULT_LIMITS.maxBodyBytes }),
      source: 'live',
    });

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.reports.simple.length).toBeGreaterThan(100);
    for (const finding of result.findings) {
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
