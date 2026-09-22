import { describe, expect, it } from 'vitest';
import { parseAuditRequest } from './index';
import { RateLimiter } from './rate-limit';
import { listFixtures, resolveFixtureBundle } from './fixtures';

describe('parseAuditRequest', () => {
  it('accepts a JSON object with a url', () => {
    const result = parseAuditRequest(JSON.stringify({ url: 'https://example.com' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.url).toBe('https://example.com');
  });

  it('carries an optional turnstile token', () => {
    const result = parseAuditRequest(JSON.stringify({ url: 'example.com', turnstileToken: 'abc' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.turnstileToken).toBe('abc');
  });

  it('rejects malformed bodies with a machine-readable code', () => {
    expect(parseAuditRequest('not json')).toMatchObject({ ok: false, code: 'INVALID_JSON' });
    expect(parseAuditRequest('[]')).toMatchObject({ ok: false, code: 'INVALID_BODY' });
    expect(parseAuditRequest('{}')).toMatchObject({ ok: false, code: 'URL_REQUIRED' });
    expect(parseAuditRequest(JSON.stringify({ url: 42 }))).toMatchObject({ ok: false, code: 'URL_REQUIRED' });
  });
});

describe('rate limiter', () => {
  it('allows up to the maximum inside the window, then blocks with a retry hint', () => {
    const limiter = new RateLimiter(2, 60_000);
    const now = 1_000_000;
    expect(limiter.check('ip', now).allowed).toBe(true);
    expect(limiter.check('ip', now + 1).allowed).toBe(true);
    const blocked = limiter.check('ip', now + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('slides the window forward', () => {
    const limiter = new RateLimiter(1, 1_000);
    expect(limiter.check('ip', 0).allowed).toBe(true);
    expect(limiter.check('ip', 500).allowed).toBe(false);
    expect(limiter.check('ip', 1_001).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1, 1_000);
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
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
