import type { HttpTransport, RawRequest, RawResponse } from './types';
import { sha256Hex } from '../util/hash';

export interface LiveTransportOptions {
  requestTimeoutMs: number;
  maxBodyBytes: number;
}

/**
 * Real network transport. One request, no redirect following, body capped and
 * hashed. Used by the Worker at runtime and by live tests. Never used in
 * deterministic CI.
 */
export class LiveTransport implements HttpTransport {
  constructor(private readonly options: LiveTransportOptions) {}

  async fetch(request: RawRequest): Promise<RawResponse> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'ArgusAudit/0.1 (+passive public-surface checks)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5',
          'accept-language': 'en',
        },
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const setCookie = readSetCookie(response.headers);
      const result: RawResponse = {
        requestedUrl: request.url,
        method: request.method,
        status: response.status,
        headers,
        durationMs: Date.now() - started,
        source: 'live',
      };
      if (setCookie.length > 0) result.setCookie = setCookie;

      if (request.method === 'GET') {
        const captured = await readBodyCapped(response, this.options.maxBodyBytes);
        if (captured.text.length > 0) result.bodyText = captured.text;
        result.bodyBytes = captured.bytes;
        result.bodyTruncated = captured.truncated;
        result.bodySha256 = await sha256Hex(captured.text);
      }

      return result;
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        requestedUrl: request.url,
        method: request.method,
        status: 0,
        headers: {},
        durationMs: Date.now() - started,
        source: 'live',
        error: {
          code: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isAbort
            ? `Request exceeded ${this.options.requestTimeoutMs} ms`
            : sanitizeErrorMessage(error),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readBodyCapped(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (response.body === null) {
    const text = await response.text();
    return { text, bytes: text.length, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      const remaining = maxBytes - bytes;
      if (value.byteLength >= remaining) {
        chunks.push(value.slice(0, remaining));
        bytes += remaining;
        truncated = true;
        break;
      }
      chunks.push(value);
      bytes += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancellation errors
    }
  }

  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), bytes, truncated };
}

function readSetCookie(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    return withGetter.getSetCookie();
  }
  const merged = headers.get('set-cookie');
  return merged === null ? [] : [merged];
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return 'Unknown network error';
}
