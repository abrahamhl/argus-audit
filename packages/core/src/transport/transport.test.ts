import { describe, expect, it } from 'vitest';
import { FixtureTransport } from './fixture';
import { HttpClient, MemoTransport } from './client';
import { fixedClock } from '../util/clock';
import type { HttpTransport, RawRequest, RawResponse } from './types';
import type { FixtureBundle } from './fixture-types';

const CLOCK = fixedClock('2026-09-21T12:00:00.000Z');
const CLIENT_OPTIONS = { maxRedirects: 5, deadlineMs: 45_000, maxTotalRequests: 50, validateRedirects: true };

describe('FixtureTransport', () => {
  const bundle: FixtureBundle = {
    id: 'mini',
    name: 'mini fixture',
    target: 'https://mini.test/',
    recordedAt: '2026-09-20T00:00:00.000Z',
    responses: [
      { url: 'https://mini.test/', status: 200, headers: { 'content-type': 'text/html' }, body: '<html></html>' },
      { url: 'https://mini.test/head-only', status: 204, headers: {} },
    ],
  };

  it('replays recorded responses and marks them as fixture data', async () => {
    const transport = new FixtureTransport(bundle);
    const response = await transport.fetch({ url: 'https://mini.test/', method: 'GET' });
    expect(response.status).toBe(200);
    expect(response.source).toBe('fixture');
    expect(response.fixtureId).toBe('mini');
    expect(response.recordedAt).toBe('2026-09-20T00:00:00.000Z');
    expect(response.bodyText).toContain('<html>');
    expect(response.bodySha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers HEAD from a recorded GET without a body', async () => {
    const transport = new FixtureTransport(bundle);
    const response = await transport.fetch({ url: 'https://mini.test/', method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.bodyText).toBeUndefined();
  });

  it('returns a marked 404 for URLs that are not in the bundle instead of touching the network', async () => {
    const transport = new FixtureTransport(bundle);
    const response = await transport.fetch({ url: 'https://mini.test/unknown', method: 'GET' });
    expect(response.status).toBe(404);
    expect(response.source).toBe('fixture');
    expect(response.bodyText).toContain('fixture');
  });
});

describe('HttpClient', () => {
  it('follows redirects and records the chain', async () => {
    const bundle: FixtureBundle = {
      id: 'redirects',
      name: 'redirects',
      target: 'http://redir.test/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [
        { url: 'http://redir.test/', status: 301, headers: { location: 'https://redir.test/' } },
        { url: 'https://redir.test/', status: 200, headers: { 'content-type': 'text/html' }, body: 'ok' },
      ],
    };
    const client = new HttpClient(new FixtureTransport(bundle), CLOCK, CLIENT_OPTIONS);
    const exchange = await client.request('http://redir.test/', { method: 'GET' });
    expect(exchange.status).toBe(200);
    expect(exchange.finalUrl).toBe('https://redir.test/');
    expect(exchange.redirects).toHaveLength(1);
    expect(exchange.redirects[0]?.location).toBe('https://redir.test/');
  });

  it('blocks redirects to private network space', async () => {
    const bundle: FixtureBundle = {
      id: 'ssrf-redirect',
      name: 'ssrf redirect',
      target: 'https://ssrf.test/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [
        { url: 'https://ssrf.test/', status: 302, headers: { location: 'http://169.254.169.254/latest' } },
      ],
    };
    const client = new HttpClient(new FixtureTransport(bundle), CLOCK, CLIENT_OPTIONS);
    const exchange = await client.request('https://ssrf.test/', { method: 'GET' });
    expect(exchange.error?.code).toBe('REDIRECT_BLOCKED');
    expect(exchange.redirects).toHaveLength(1);
  });

  it('stops after the redirect limit', async () => {
    const bundle: FixtureBundle = {
      id: 'redirect-loop',
      name: 'redirect loop',
      target: 'https://loop.test/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [{ url: 'https://loop.test/', status: 302, headers: { location: 'https://loop.test/' } }],
    };
    const client = new HttpClient(new FixtureTransport(bundle), CLOCK, CLIENT_OPTIONS);
    const exchange = await client.request('https://loop.test/', { method: 'GET' });
    expect(exchange.error?.code).toBe('REDIRECT_LIMIT');
  });

  it('reports transport errors as ERROR-worthy exchanges without a status', async () => {
    const bundle: FixtureBundle = {
      id: 'dns-fail',
      name: 'dns fail',
      target: 'https://gone.test/',
      recordedAt: '2026-09-20T00:00:00.000Z',
      responses: [
        { url: 'https://gone.test/', status: 0, error: { code: 'ENOTFOUND', message: 'DNS lookup failed' } },
      ],
    };
    const client = new HttpClient(new FixtureTransport(bundle), CLOCK, CLIENT_OPTIONS);
    const exchange = await client.request('https://gone.test/', { method: 'GET' });
    expect(exchange.status).toBe(0);
    expect(exchange.ok).toBe(false);
    expect(exchange.error?.code).toBe('ENOTFOUND');
  });
});

describe('MemoTransport', () => {
  it('performs one underlying request per method+URL per audit', async () => {
    let calls = 0;
    const inner: HttpTransport = {
      async fetch(request: RawRequest): Promise<RawResponse> {
        calls += 1;
        return {
          requestedUrl: request.url,
          method: request.method,
          status: 200,
          headers: {},
          durationMs: 0,
          source: 'fixture',
        };
      },
    };
    const memo = new MemoTransport(inner);
    await memo.fetch({ url: 'https://memo.test/', method: 'GET' });
    await memo.fetch({ url: 'https://memo.test/', method: 'GET' });
    await memo.fetch({ url: 'https://memo.test/', method: 'HEAD' });
    expect(calls).toBe(2);
  });
});
