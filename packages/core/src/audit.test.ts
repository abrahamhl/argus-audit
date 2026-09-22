import { describe, expect, it } from 'vitest';
import { runAudit, type AuditResult } from './audit';
import { TEST_AUDIT_ID, fixtureAuditOptions } from './test-utils';
import { FixtureTransport } from './transport/fixture';
import { fixedClock } from './util/clock';
import { FORBIDDEN_CLAIM_PHRASES } from './claims';
import type { FixtureBundle } from './transport/fixture-types';

async function auditFixture(id: string): Promise<AuditResult> {
  return runAudit(fixtureAuditOptions(id));
}

function sortedIds(result: AuditResult, severity: 'critical' | 'review' | 'informational'): string[] {
  return result.findings
    .filter((finding) => finding.severity === severity)
    .map((finding) => finding.findingId)
    .sort();
}

describe('end-to-end fixture audits', () => {
  it('healthy-site: only one informational finding, nothing alarming', async () => {
    const result = await auditFixture('healthy-site');
    expect(result.source).toBe('fixture');
    expect(result.summary.state).toBe('OBSERVED');
    expect(result.summary.counts).toEqual({ critical: 0, review: 0, informational: 1, total: 1 });
    expect(sortedIds(result, 'informational')).toEqual(['headers.permissions-policy-not-observed']);
    expect(result.summary.headline).toContain('informational observation');
    expect(result.evidence.every((record) => record.provenance.source === 'fixture')).toBe(true);
    expect(result.evidence.every((record) => record.provenance.fixtureId === 'healthy-site')).toBe(true);
  });

  it('missing-headers: three review findings and four informational ones', async () => {
    const result = await auditFixture('missing-headers');
    expect(result.summary.counts).toEqual({ critical: 0, review: 3, informational: 4, total: 7 });
    expect(sortedIds(result, 'review')).toEqual([
      'headers.clickjacking-protection-not-observed',
      'headers.content-security-policy-not-observed',
      'transport.hsts-not-observed',
    ]);
    expect(sortedIds(result, 'informational')).toEqual([
      'headers.permissions-policy-not-observed',
      'headers.referrer-policy-not-observed',
      'headers.x-content-type-options-not-observed',
      'privacy.consent-indicator-not-detected',
    ]);
  });

  it('messy-site: mixed findings, zero critical, privacy and link problems surfaced', async () => {
    const result = await auditFixture('messy-site');
    expect(result.summary.counts).toEqual({ critical: 0, review: 6, informational: 7, total: 13 });
    expect(sortedIds(result, 'review')).toEqual([
      'headers.clickjacking-protection-not-observed',
      'headers.content-security-policy-not-observed',
      'privacy.cookie-flags-incomplete',
      'privacy.privacy-page-unreachable',
      'transport.hsts-not-observed',
      'transport.no-https-redirect',
    ]);
    expect(sortedIds(result, 'informational')).toContain('links.broken-sample');
    expect(sortedIds(result, 'informational')).toContain('a11y.html-lang-not-observed');
    expect(sortedIds(result, 'informational')).toContain('a11y.images-missing-alt');

    const broken = result.findings.find((finding) => finding.findingId === 'links.broken-sample');
    expect(broken?.summary).toContain('3 of 4');
  });

  it('unreachable target: critical ERROR finding, audit still renders all reports', async () => {
    const bundle: FixtureBundle = {
      id: 'unreachable',
      name: 'unreachable target',
      target: 'https://unreachable.test/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [
        { url: 'https://unreachable.test/', status: 0, error: { code: 'ENOTFOUND', message: 'DNS lookup failed' } },
        { url: 'http://unreachable.test/', status: 0, error: { code: 'ENOTFOUND', message: 'DNS lookup failed' } },
      ],
    };
    const result = await runAudit({
      target: bundle.target,
      transport: new FixtureTransport(bundle),
      clock: fixedClock('2026-09-21T12:00:00.000Z'),
      auditId: TEST_AUDIT_ID,
      source: 'fixture',
      limits: { perRequestDelayMs: 0 },
    });

    expect(result.summary.state).toBe('ERROR');
    const critical = result.findings.filter((finding) => finding.severity === 'critical');
    expect(critical).toHaveLength(1);
    expect(critical[0]?.findingId).toBe('availability.https-unreachable');
    expect(critical[0]?.state).toBe('ERROR');
    expect(result.reports.simple.length).toBeGreaterThan(100);
    expect(result.reports.engineer).toContain('availability.https-unreachable');
    expect(result.reports.client).toContain('could not complete');
  });
});

describe('audit invariants', () => {
  const fixtures = ['healthy-site', 'missing-headers', 'messy-site'] as const;

  it('every finding points back to evidence that exists in the audit', async () => {
    for (const id of fixtures) {
      const result = await auditFixture(id);
      const evidenceIds = new Set(result.evidence.map((record) => record.evidenceId));
      expect(result.findings.length).toBeGreaterThan(0);
      for (const finding of result.findings) {
        expect(finding.evidenceIds.length, `${finding.findingId} has no evidence`).toBeGreaterThan(0);
        for (const evidenceId of finding.evidenceIds) {
          expect(evidenceIds.has(evidenceId), `${finding.findingId} → ${evidenceId}`).toBe(true);
        }
      }
      expect(result.summary.counts.total).toBe(result.findings.length);
    }
  });

  it('every evidence record carries provenance, a state and limitations', async () => {
    for (const id of fixtures) {
      const result = await auditFixture(id);
      for (const record of result.evidence) {
        expect(record.provenance.requestedUrl.length).toBeGreaterThan(0);
        expect(record.observedAt.length).toBeGreaterThan(0);
        expect(record.limitations.length).toBeGreaterThan(0);
        expect(record.evidenceId.startsWith(`${result.auditId}:`)).toBe(true);
      }
    }
  });

  it('reports include methodology version, audit id and the boundary statement', async () => {
    const result = await auditFixture('messy-site');
    expect(result.reports.engineer).toContain(result.methodologyVersion);
    expect(result.reports.engineer).toContain(result.auditId);
    expect(result.reports.client).toContain('not a security assessment');
    expect(result.reports.simple).toContain(result.summary.headline);
    expect(result.reports.simple).not.toContain('```json');
    expect(result.reports.engineer).toContain('```json');
  });

  it('produces identical output for identical inputs (determinism)', async () => {
    const first = await auditFixture('messy-site');
    const second = await auditFixture('messy-site');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('rejects targets that fail the URL guard', async () => {
    await expect(
      runAudit({
        target: 'http://localhost/',
        transport: new FixtureTransport({
          id: 'x',
          name: 'x',
          target: 'http://localhost/',
          recordedAt: '2026-09-20T00:00:00.000Z',
          responses: [],
        }),
      }),
    ).rejects.toThrow(/not auditable/i);
  });
});

describe('evidence canonical hash', () => {
  it('is a stable SHA-256 over the canonical evidence set and lands in the engineer report', async () => {
    const first = await auditFixture('messy-site');
    const second = await auditFixture('messy-site');
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.evidenceHash).toBe(second.evidenceHash);
    expect(first.reports.engineer).toContain(first.evidenceHash);

    const other = await auditFixture('healthy-site');
    expect(other.evidenceHash).not.toBe(first.evidenceHash);
  });
});

describe('blocked root responses (WAF / challenge pages)', () => {
  const blockedBundle: FixtureBundle = {
    id: 'blocked-root',
    name: 'WAF-blocked root',
    target: 'https://blocked.test/',
    recordedAt: '2026-09-20T00:00:00.000Z',
    responses: [
      {
        url: 'http://blocked.test/',
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html><body>plain</body></html>',
      },
      {
        url: 'https://blocked.test/',
        status: 403,
        headers: { 'content-type': 'text/html', server: 'cloudflare' },
        body: '<html><body>Attention Required! Challenge page</body></html>',
      },
    ],
  };

  it('never turns an error-status root into header, privacy or accessibility findings', async () => {
    const result = await runAudit({
      target: blockedBundle.target,
      transport: new FixtureTransport(blockedBundle),
      clock: fixedClock('2026-09-21T12:00:00.000Z'),
      auditId: TEST_AUDIT_ID,
      source: 'fixture',
      limits: { perRequestDelayMs: 0 },
    });

    expect(result.findings.map((finding) => finding.findingId)).toEqual(['transport.no-https-redirect']);
    const scan = result.evidence.find((record) => record.checkId === 'privacy.link.scan');
    expect(scan?.state).toBe('NOT_CHECKED');
    expect(scan?.data).toMatchObject({ reason: 'blocked' });
    const a11y = result.evidence.find((record) => record.checkId === 'a11y.signals');
    expect(a11y?.state).toBe('NOT_CHECKED');
  });
});

describe('claims guard', () => {
  it('never states legal conclusions, fines or fear marketing in any report', async () => {
    for (const id of ['healthy-site', 'missing-headers', 'messy-site'] as const) {
      const result = await auditFixture(id);
      for (const mode of ['simple', 'engineer', 'client'] as const) {
        const text = result.reports[mode].toLowerCase();
        for (const phrase of FORBIDDEN_CLAIM_PHRASES) {
          expect(text.includes(phrase), `${id}/${mode} contains "${phrase}"`).toBe(false);
        }
      }
    }
  });
});

describe('optional AI explanation layer', () => {
  it('falls back to deterministic text when the explainer fails', async () => {
    const options = fixtureAuditOptions('messy-site');
    const result = await runAudit({
      ...options,
      explainer: {
        id: 'failing-test-explainer',
        enabled: true,
        async explain() {
          throw new Error('provider unavailable');
        },
      },
    });
    expect(result.explainer.error).toContain('provider unavailable');
    expect(result.explainer.applied).toBe(0);
    expect(result.reports.client).toContain('not a security assessment');
    expect(result.summary.counts.total).toBe(13);
  });

  it('rejects AI output that introduces a forbidden legal or fear claim', async () => {
    const options = fixtureAuditOptions('messy-site');
    const result = await runAudit({
      ...options,
      explainer: {
        id: 'claim-injecting-test-explainer',
        enabled: true,
        async explain() {
          return { clientExplanation: 'This company violates GDPR and will be fined.' };
        },
      },
    });
    expect(result.explainer.applied).toBe(0);
    expect(result.explainer.error).toContain('forbidden claim');
    for (const finding of result.findings) {
      expect(finding.clientExplanation.toLowerCase()).not.toContain('violates gdpr');
    }
  });

  it('applies a successful explanation while keeping deterministic findings intact', async () => {
    const options = fixtureAuditOptions('messy-site');
    const result = await runAudit({
      ...options,
      explainer: {
        id: 'replacement-test-explainer',
        enabled: true,
        async explain({ finding }) {
          return { clientExplanation: `Friendly explanation for ${finding.findingId}.` };
        },
      },
    });
    expect(result.explainer.applied).toBe(result.findings.length);
    const privacy = result.findings.find((finding) => finding.findingId === 'privacy.no-privacy-link');
    if (privacy !== undefined) {
      expect(privacy.clientExplanation).toContain('Friendly explanation');
    }
    expect(result.findings.every((finding) => finding.evidenceIds.length > 0)).toBe(true);
  });
});
