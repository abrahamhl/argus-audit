import { describe, expect, it } from 'vitest';
import { allRules, createEvidenceIndex, evaluateRules } from './index';
import { buildFinding, type Rule } from './types';
import { compareFindings, type Finding } from '../finding';
import { EvidenceBuilder } from '../evidence';
import { fixedClock } from '../util/clock';
import { HEADER_SPECS } from '../scanners/security-headers';

describe('rule registry', () => {
  it('has unique ids, versions and titles', () => {
    const ids = allRules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of allRules) {
      expect(rule.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(rule.title.length).toBeGreaterThan(5);
      expect(Array.isArray(rule.standards)).toBe(true);
    }
  });

  it('produces no findings when there is no evidence', () => {
    const findings = evaluateRules([], {
      generatedAt: '2026-09-21T12:00:00.000Z',
      methodologyVersion: '0.1.0',
      targetUrl: 'https://example.com/',
    });
    expect(findings).toEqual([]);
  });

  it('never emits a finding without a reference to existing evidence', () => {
    const builder = new EvidenceBuilder('a', fixedClock('2026-09-21T12:00:00.000Z'));
    builder.add({
      scannerId: 'test',
      scannerVersion: '1.0.0',
      checkId: 'tls.https.reachable',
      kind: 'tls.indicator',
      state: 'ERROR',
      subject: 'https://example.com/',
      method: 'GET',
      data: { error: { code: 'ENOTFOUND', message: 'dns' } },
      provenance: { source: 'fixture', requestedUrl: 'https://example.com/' },
      limitations: ['test'],
    });
    const findings = evaluateRules(builder.records, {
      generatedAt: '2026-09-21T12:00:00.000Z',
      methodologyVersion: '0.1.0',
      targetUrl: 'https://example.com/',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidenceIds).toEqual([builder.records[0]?.evidenceId]);
  });
});

describe('finding helpers', () => {
  it('refuses to build a finding without evidence references', () => {
    const rule: Rule = {
      id: 'test.rule',
      version: '1.0.0',
      title: 'Test rule',
      category: 'content-quality',
      severity: 'informational',
      standards: [],
      evaluate: () => null,
    };
    expect(() =>
      buildFinding({
        rule,
        state: 'OBSERVED',
        confidence: 'high',
        summary: 's',
        whyItMatters: 'w',
        howToReproduce: ['r'],
        howToFix: 'f',
        clientExplanation: 'c',
        evidenceIds: [],
      }),
    ).toThrow(/without evidence/);
  });

  it('orders findings by severity, then id', () => {
    const base: Omit<Finding, 'findingId' | 'ruleId' | 'title' | 'severity'> = {
      ruleVersion: '1.0.0',
      category: 'content-quality',
      state: 'OBSERVED',
      confidence: 'high',
      summary: 's',
      whyItMatters: 'w',
      howToReproduce: [],
      howToFix: 'f',
      clientExplanation: 'c',
      evidenceIds: ['e'],
      standards: [],
      limitations: [],
    };
    const findings: Finding[] = (
      [
        { ...base, findingId: 'z-info', ruleId: 'z', title: 'z', severity: 'informational' },
        { ...base, findingId: 'b-review', ruleId: 'b', title: 'b', severity: 'review' },
        { ...base, findingId: 'a-review', ruleId: 'a', title: 'a', severity: 'review' },
        { ...base, findingId: 'c-critical', ruleId: 'c', title: 'c', severity: 'critical' },
      ] satisfies Finding[]
    ).sort(compareFindings);
    expect(findings.map((finding) => finding.findingId)).toEqual([
      'c-critical',
      'a-review',
      'b-review',
      'z-info',
    ]);
  });
});

describe('header specs', () => {
  it('lists each header once with actionable remediation text', () => {
    const names = HEADER_SPECS.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
    for (const spec of HEADER_SPECS) {
      expect(spec.howToFix.length).toBeGreaterThan(20);
      expect(spec.whyItMatters.length).toBeGreaterThan(40);
    }
  });
});

describe('evidence index', () => {
  it('finds records by check id', () => {
    const builder = new EvidenceBuilder('a', fixedClock('2026-09-21T12:00:00.000Z'));
    builder.add({
      scannerId: 'test',
      scannerVersion: '1.0.0',
      checkId: 'x',
      kind: 'internal',
      state: 'OBSERVED',
      subject: 's',
      method: 'm',
      data: {},
      provenance: { source: 'fixture', requestedUrl: 'https://example.com/' },
      limitations: [],
    });
    const index = createEvidenceIndex(builder.records);
    expect(index.first('x')?.evidenceId).toBe(builder.records[0]?.evidenceId);
    expect(index.allOf('missing')).toEqual([]);
  });
});
