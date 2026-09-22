import { describe, expect, it } from 'vitest';
import { createTestHarness, loadFixtureBundle } from '../test-utils';
import { CHECK_IDS } from '../contracts';
import { reachabilityScanner } from './reachability';
import { transportSecurityScanner } from './transport-security';
import { securityHeadersScanner } from './security-headers';
import { privacyPagesScanner } from './privacy-pages';
import { brokenLinksScanner } from './broken-links';
import { frontendTechScanner } from './frontend-tech';
import type { EvidenceRecord } from '../evidence';
import { boolOf, dataOf, numOf, strOf } from '../rules/types';

async function runScanner(
  fixtureId: string,
  scanner: { run: (ctx: ReturnType<typeof createTestHarness>['ctx']) => Promise<void> },
): Promise<EvidenceRecord[]> {
  const harness = createTestHarness(loadFixtureBundle(fixtureId));
  await scanner.run(harness.ctx);
  return harness.evidence.records;
}

function first(records: EvidenceRecord[], checkId: string): EvidenceRecord {
  const record = records.find((candidate) => candidate.checkId === checkId);
  if (record === undefined) throw new Error(`Missing evidence for ${checkId}`);
  return record;
}

describe('reachability scanner', () => {
  it('records both schemes with the HTTP redirect chain', async () => {
    const records = await runScanner('healthy-site', reachabilityScanner);
    const https = first(records, CHECK_IDS.httpsResponse);
    const http = first(records, CHECK_IDS.httpResponse);

    expect(https.state).toBe('OBSERVED');
    expect(numOf(https, 'status')).toBe(200);
    expect(https.provenance.source).toBe('fixture');
    const httpData = dataOf(http);
    expect(httpData['redirects']).toEqual([
      { url: 'http://healthy-site.test/', status: 301, location: 'https://healthy-site.test/' },
    ]);
  });
});

describe('transport-security scanner', () => {
  it('observes HSTS and the HTTPS redirect on the healthy fixture', async () => {
    const records = await runScanner('healthy-site', transportSecurityScanner);
    const hsts = first(records, CHECK_IDS.hsts);
    const redirect = first(records, CHECK_IDS.httpRedirect);
    const certificate = first(records, CHECK_IDS.certificate);

    expect(boolOf(hsts, 'present')).toBe(true);
    expect(numOf(hsts, 'maxAgeSeconds')).toBe(63072000);
    expect(boolOf(redirect, 'upgradedToHttps')).toBe(true);
    expect(certificate.state).toBe('NOT_CHECKED');
    expect(strOf(certificate, 'reason')).toBe('runtime-does-not-expose-certificate');
  });

  it('observes the missing HSTS on the missing-headers fixture', async () => {
    const records = await runScanner('missing-headers', transportSecurityScanner);
    expect(boolOf(first(records, CHECK_IDS.hsts), 'present')).toBe(false);
    expect(boolOf(first(records, CHECK_IDS.httpRedirect), 'upgradedToHttps')).toBe(true);
  });

  it('observes the absent HTTPS redirect on the messy fixture', async () => {
    const records = await runScanner('messy-site', transportSecurityScanner);
    expect(boolOf(first(records, CHECK_IDS.httpRedirect), 'upgradedToHttps')).toBe(false);
  });
});

describe('security-headers scanner', () => {
  it('records header presence and cookie flags without cookie values', async () => {
    const records = await runScanner('messy-site', securityHeadersScanner);
    const csp = first(records, CHECK_IDS.headerPresence('content-security-policy'));
    const cookies = first(records, CHECK_IDS.cookies);
    const cookieData = dataOf(cookies);

    expect(boolOf(csp, 'present')).toBe(false);
    expect(numOf(cookies, 'cookieCount')).toBe(2);
    expect(numOf(cookies, 'withoutSecure')).toBe(2);
    expect(numOf(cookies, 'withoutSameSite')).toBe(1);
    expect(JSON.stringify(cookies.data)).not.toContain('redacted-fixture-value');
  });

  it('records present values on the healthy fixture', async () => {
    const records = await runScanner('healthy-site', securityHeadersScanner);
    const csp = first(records, CHECK_IDS.headerPresence('content-security-policy'));
    expect(boolOf(csp, 'present')).toBe(true);
    expect(strOf(csp, 'value')).toContain('frame-ancestors');
  });
});

describe('privacy-pages scanner', () => {
  it('classifies German legal pages and checks the privacy page', async () => {
    const records = await runScanner('missing-headers', privacyPagesScanner);
    const privacy = first(records, CHECK_IDS.privacyLinkPresence('privacy'));
    const legal = first(records, CHECK_IDS.privacyLinkPresence('legal'));
    const page = first(records, CHECK_IDS.privacyPageReachability);

    expect(boolOf(privacy, 'found')).toBe(true);
    expect(boolOf(legal, 'found')).toBe(true);
    expect(numOf(page, 'status')).toBe(200);
  });

  it('records an unreachable privacy page on the messy fixture', async () => {
    const records = await runScanner('messy-site', privacyPagesScanner);
    const page = first(records, CHECK_IDS.privacyPageReachability);
    expect(numOf(page, 'status')).toBe(404);
    expect(page.state).toBe('OBSERVED');
  });

  it('detects consent-tool indicators on the healthy fixture', async () => {
    const records = await runScanner('healthy-site', privacyPagesScanner);
    const consent = first(records, CHECK_IDS.consentIndicator);
    expect(dataOf(consent)['detectedTools']).toEqual(['Klaro']);
  });
});

describe('broken-links scanner', () => {
  it('samples internal non-legal links and counts failures', async () => {
    const records = await runScanner('messy-site', brokenLinksScanner);
    const summary = first(records, CHECK_IDS.linkSummary);
    const linkRecords = records.filter((record) => record.checkId === CHECK_IDS.linkStatus);

    expect(linkRecords).toHaveLength(4);
    expect(numOf(summary, 'sampled')).toBe(4);
    expect(numOf(summary, 'broken')).toBe(3);
    const paths = linkRecords.map((record) => strOf(record, 'path'));
    expect(paths).toEqual([
      'messy-site.test/shop',
      'messy-site.test/old-page',
      'messy-site.test/about',
      'messy-site.test/contact',
    ]);
  });

  it('finds no broken links on the healthy fixture', async () => {
    const records = await runScanner('healthy-site', brokenLinksScanner);
    const summary = first(records, CHECK_IDS.linkSummary);
    expect(numOf(summary, 'sampled')).toBe(3);
    expect(numOf(summary, 'broken')).toBe(0);
  });
});

describe('frontend-tech scanner', () => {
  it('identifies indicators as INFERRED with an excerpt', async () => {
    const records = await runScanner('messy-site', frontendTechScanner);
    const summary = first(records, CHECK_IDS.techSummary);
    expect(Array.isArray(dataOf(summary)['detected'])).toBe(true);
    const detected = dataOf(summary)['detected'] as string[];
    expect(detected).toContain('WordPress');
    expect(detected).toContain('jQuery');
    expect(detected).toContain('Express');

    const indicator = records.find((record) => record.checkId === CHECK_IDS.techIndicator);
    expect(indicator?.state).toBe('INFERRED');
    expect(indicator?.data).not.toBeNull();
  });

  it('records accessibility signals from the homepage HTML', async () => {
    const records = await runScanner('messy-site', frontendTechScanner);
    const a11y = first(records, CHECK_IDS.a11ySignals);
    expect(strOf(a11y, 'htmlLang')).toBeNull();
    expect(numOf(a11y, 'imagesTotal')).toBe(3);
    expect(numOf(a11y, 'imagesMissingAlt')).toBe(2);
  });
});
