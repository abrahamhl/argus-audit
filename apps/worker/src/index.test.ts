import { describe, expect, it } from 'vitest';
import { isOriginAllowed, parseAuditRequest } from './index';
import { RateLimiter } from './rate-limit';
import { evaluateWindow } from './abuse-window';
import { listFixtures, resolveFixtureBundle } from './fixtures';
import { buildMethodology } from './methodology';

describe('parseAuditRequest', () => {
  it('accepts a JSON object with a url and explicit acknowledgement', () => {
    const result = parseAuditRequest(JSON.stringify({ url: 'https://example.com', acknowledged: true }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.url).toBe('https://example.com');
  });

  it('requires the authorisation acknowledgement by default', () => {
    expect(parseAuditRequest(JSON.stringify({ url: 'https://example.com' }))).toMatchObject({
      ok: false,
      code: 'ACKNOWLEDGEMENT_REQUIRED',
    });
    expect(parseAuditRequest(JSON.stringify({ url: 'https://example.com', acknowledged: false }))).toMatchObject({
      ok: false,
      code: 'ACKNOWLEDGEMENT_REQUIRED',
    });
  });

  it('allows the lab route to skip the acknowledgement but still requires a url', () => {
    expect(
      parseAuditRequest(JSON.stringify({ url: 'https://healthy-site.test/' }), {
        requireAcknowledgement: false,
      }).ok,
    ).toBe(true);
    expect(
      parseAuditRequest(JSON.stringify({}), { requireAcknowledgement: false }),
    ).toMatchObject({ ok: false, code: 'URL_REQUIRED' });
  });

  it('carries an optional turnstile token', () => {
    const result = parseAuditRequest(
      JSON.stringify({ url: 'example.com', acknowledged: true, turnstileToken: 'abc' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.turnstileToken).toBe('abc');
  });

  it('rejects malformed bodies with a machine-readable code', () => {
    expect(parseAuditRequest('not json')).toMatchObject({ ok: false, code: 'INVALID_JSON' });
    expect(parseAuditRequest('[]')).toMatchObject({ ok: false, code: 'INVALID_BODY' });
    expect(parseAuditRequest('{}')).toMatchObject({ ok: false, code: 'URL_REQUIRED' });
    expect(parseAuditRequest(JSON.stringify({ url: 42, acknowledged: true }))).toMatchObject({
      ok: false,
      code: 'URL_REQUIRED',
    });
  });
});

describe('origin policy', () => {
  it('allows requests without an Origin header (non-browser clients)', () => {
    expect(isOriginAllowed(null, 'argus-audit.argus-lab.workers.dev')).toBe(true);
  });

  it('allows same-host origins only', () => {
    expect(isOriginAllowed('https://argus-audit.argus-lab.workers.dev', 'argus-audit.argus-lab.workers.dev')).toBe(
      true,
    );
    expect(isOriginAllowed('https://evil.example', 'argus-audit.argus-lab.workers.dev')).toBe(false);
    expect(isOriginAllowed('not a url', 'argus-audit.argus-lab.workers.dev')).toBe(false);
  });

  it('honours an explicit ALLOWED_ORIGIN override for local development', () => {
    expect(isOriginAllowed('http://localhost:5173', '127.0.0.1:8787', 'http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('http://localhost:9999', '127.0.0.1:8787', 'http://localhost:5173')).toBe(false);
  });
});

describe('sliding-window guard', () => {
  it('allows up to the maximum inside the window, then blocks with a retry hint', () => {
    let hits: number[] = [];
    for (let index = 0; index < 2; index += 1) {
      const decision = evaluateWindow(hits, 1_000_000 + index, 2, 60_000);
      expect(decision.allowed).toBe(true);
      hits = decision.hits;
    }
    const blocked = evaluateWindow(hits, 1_000_002, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('slides the window forward', () => {
    const first = evaluateWindow([], 0, 1, 1_000);
    expect(first.allowed).toBe(true);
    expect(evaluateWindow(first.hits, 500, 1, 1_000).allowed).toBe(false);
    expect(evaluateWindow(first.hits, 1_001, 1, 1_000).allowed).toBe(true);
  });
});

describe('in-memory fallback limiter', () => {
  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1, 1_000);
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 1).allowed).toBe(false);
  });
});

describe('fixture registry', () => {
  it('lists exactly the three deterministic demo fixtures', () => {
    const fixtures = listFixtures();
    expect(fixtures.map((fixture) => fixture.id).sort()).toEqual(['healthy-site', 'messy-site', 'missing-headers']);
    for (const fixture of fixtures) {
      expect(fixture.recordedAt).toMatch(/^2026-/);
      expect(fixture.target).toMatch(/\.test\/$/);
    }
  });

  it('resolves a fixture by normalized target hostname', () => {
    expect(resolveFixtureBundle('https://healthy-site.test/')?.id).toBe('healthy-site');
    expect(resolveFixtureBundle('https://example.com/')).toBeNull();
  });
});

describe('methodology surface', () => {
  it('reports the same scanners, states and limits the runtime uses', () => {
    const methodology = buildMethodology();
    expect(methodology.methodologyVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(methodology.scanners.map((scanner) => scanner.id)).toContain('http.reachability');
    expect(methodology.scanners.map((scanner) => scanner.id)).toContain('dns.records');
    expect(methodology.scanners.length).toBe(8);
    expect(methodology.rules.length).toBeGreaterThan(20);
    expect(methodology.states['NOT_CHECKED']).toContain('out of scope');
    expect(methodology.limits.maxRedirects).toBe(5);
    for (const rule of methodology.rules) {
      expect(rule.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(rule.title.length).toBeGreaterThan(5);
    }
  });
});
