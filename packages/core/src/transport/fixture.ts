import type { HttpTransport, RawRequest, RawResponse } from './types';
import type { FixtureBundle, FixtureResponse } from './fixture-types';

interface FixtureKey {
  method: 'GET' | 'HEAD';
  url: string;
}

function normalizeKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

/**
 * Replays recorded responses. Deterministic: same bundle in → same evidence
 * out. Unknown URLs return a synthetic 404 marked as fixture data so an audit
 * never silently touches the network.
 */
export class FixtureTransport implements HttpTransport {
  private readonly responses: Map<string, FixtureResponse>;

  constructor(private readonly bundle: FixtureBundle) {
    this.responses = new Map();
    for (const response of bundle.responses) {
      const method = (response.method ?? 'GET').toUpperCase() as 'GET' | 'HEAD';
      this.responses.set(this.key({ method, url: normalizeKey(response.url) }), response);
    }
  }

  async fetch(request: RawRequest): Promise<RawResponse> {
    const normalized = normalizeKey(request.url);
    const exact = this.responses.get(this.key({ method: request.method, url: normalized }));
    const fallback =
      request.method === 'HEAD'
        ? this.responses.get(this.key({ method: 'GET', url: normalized }))
        : undefined;
    const response = exact ?? fallback;

    if (response === undefined) {
      return {
        requestedUrl: request.url,
        method: request.method,
        status: 404,
        headers: { 'content-type': 'text/plain' },
        bodyText: 'Not found in fixture bundle',
        bodyBytes: 29,
        bodyTruncated: false,
        durationMs: 0,
        source: 'fixture',
        fixtureId: this.bundle.id,
        recordedAt: this.bundle.recordedAt,
      };
    }

    const result: RawResponse = {
      requestedUrl: request.url,
      method: request.method,
      status: response.status ?? 0,
      headers: lowerCaseHeaders(response.headers ?? {}),
      durationMs: 0,
      source: 'fixture',
      fixtureId: this.bundle.id,
      recordedAt: response.recordedAt ?? this.bundle.recordedAt,
    };
    if (response.setCookie !== undefined) result.setCookie = [...response.setCookie];
    if (response.error !== undefined) {
      result.error = { ...response.error };
    }
    if (request.method === 'GET' && response.body !== undefined) {
      result.bodyText = response.body;
      result.bodyBytes = response.body.length;
      result.bodyTruncated = false;
    }
    return result;
  }

  private key(key: FixtureKey): string {
    return `${key.method} ${key.url}`;
  }
}

function lowerCaseHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}
