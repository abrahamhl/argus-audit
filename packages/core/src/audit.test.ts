import { describe, expect, it } from 'vitest';
import { runAudit, type AuditResult } from './audit';
import { TEST_AUDIT_ID, fixtureAuditOptions } from './test-utils';
import { FixtureTransport } from './transport/fixture';
import { fixedClock } from './util/clock';
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

describe('claims guard', () => {
  const forbidden = [
    'violates gdpr',
    'gdpr violation',
    'violation of the gdpr',
    'non-compliant',
    'noncompliant',
    'illegal',
    'fine of',
    'fines of',
    'will be fined',
    'lawsuit',
    'prosecut',
    'certified secure',
    'guaranteed secure',
    'guaranteed to',
    'hacked',
    'urgent action',
    'act now',
    'limited time',
  ];

  it('never states legal conclusions, fines or fear marketing in any report', async () => {
    for (const id of ['healthy-site', 'missing-headers', 'messy-site'] as const) {
      const result = await auditFixture(id);
      for (const mode of ['simple', 'engineer', 'client'] as const) {
        const text = result.reports[mode].toLowerCase();
        for (const phrase of forbidden) {
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
