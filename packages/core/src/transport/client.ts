import type { Clock } from '../util/clock';
import type { HttpTransport, RawRequest, RawResponse, TransportError } from './types';
import { isAllowedRedirectUrl } from '../url-guard';

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface HttpExchange {
  requestedUrl: string;
  finalUrl: string;
  method: 'GET' | 'HEAD';
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  setCookie?: string[];
  bodyText?: string;
  bodyBytes?: number;
  bodyTruncated?: boolean;
  bodySha256?: string;
  redirects: RedirectHop[];
  error?: TransportError;
  durationMs: number;
  source: 'live' | 'fixture';
  fixtureId?: string;
  recordedAt?: string;
}

export interface HttpClientOptions {
  maxRedirects: number;
  /** Wall-clock budget for the whole audit. */
  deadlineMs: number;
  maxTotalRequests: number;
  validateRedirects: boolean;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class HttpClient {
  private requests = 0;
  private readonly deadline: number;

  constructor(
    private readonly transport: HttpTransport,
    private readonly clock: Clock,
    private readonly options: HttpClientOptions,
  ) {
    this.deadline = clock.nowMs() + options.deadlineMs;
  }

  get requestCount(): number {
    return this.requests;
  }

  async request(url: string, options: { method?: 'GET' | 'HEAD' } = {}): Promise<HttpExchange> {
    const method = options.method ?? 'GET';
    const requestedUrl = safeHref(url);
    const redirects: RedirectHop[] = [];
    let currentUrl = url;

    for (;;) {
      const budgetError = this.checkBudget();
      if (budgetError !== null) {
        return this.errorExchange(requestedUrl, method, redirects, budgetError);
      }

      this.requests += 1;
      const response = await this.transport.fetch({ url: currentUrl, method } satisfies RawRequest);

      if (response.error !== undefined) {
        return this.errorExchange(safeHref(currentUrl), method, redirects, response.error, response);
      }

      const location = response.headers['location'] ?? null;
      if (REDIRECT_STATUSES.has(response.status) && location !== null) {
        redirects.push({ url: safeHref(currentUrl), status: response.status, location });
        if (redirects.length > this.options.maxRedirects) {
          return this.errorExchange(safeHref(currentUrl), method, redirects, {
            code: 'REDIRECT_LIMIT',
            message: `More than ${this.options.maxRedirects} redirects`,
          });
        }
        const nextUrl = resolveLocation(currentUrl, location);
        if (nextUrl === null) {
          return this.errorExchange(safeHref(currentUrl), method, redirects, {
            code: 'REDIRECT_INVALID',
            message: 'Redirect location could not be resolved',
          });
        }
        if (this.options.validateRedirects && !isAllowedRedirectUrl(nextUrl)) {
          return this.errorExchange(safeHref(currentUrl), method, redirects, {
            code: 'REDIRECT_BLOCKED',
            message: 'Redirect target is not a public HTTP(S) target',
          });
        }
        currentUrl = nextUrl;
        continue;
      }

      return this.exchangeFrom(response, requestedUrl, method, redirects);
    }
  }

  private checkBudget(): TransportError | null {
    if (this.requests >= this.options.maxTotalRequests) {
      return {
        code: 'REQUEST_BUDGET_EXCEEDED',
        message: `Audit request budget of ${this.options.maxTotalRequests} exhausted`,
      };
    }
    if (this.clock.nowMs() > this.deadline) {
      return { code: 'AUDIT_TIMEOUT', message: 'Audit time budget exhausted' };
    }
    return null;
  }

  private exchangeFrom(
    response: RawResponse,
    requestedUrl: string,
    method: 'GET' | 'HEAD',
    redirects: RedirectHop[],
  ): HttpExchange {
    const exchange: HttpExchange = {
      requestedUrl,
      finalUrl: safeHref(response.requestedUrl),
      method,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      headers: response.headers,
      redirects,
      durationMs: response.durationMs,
      source: response.source,
    };
    if (response.setCookie !== undefined) exchange.setCookie = response.setCookie;
    if (response.bodyText !== undefined) exchange.bodyText = response.bodyText;
    if (response.bodyBytes !== undefined) exchange.bodyBytes = response.bodyBytes;
    if (response.bodyTruncated !== undefined) exchange.bodyTruncated = response.bodyTruncated;
    if (response.bodySha256 !== undefined) exchange.bodySha256 = response.bodySha256;
    if (response.fixtureId !== undefined) exchange.fixtureId = response.fixtureId;
    if (response.recordedAt !== undefined) exchange.recordedAt = response.recordedAt;
    return exchange;
  }

  private errorExchange(
    requestedUrl: string,
    method: 'GET' | 'HEAD',
    redirects: RedirectHop[],
    error: TransportError,
    response?: RawResponse,
  ): HttpExchange {
    const exchange: HttpExchange = {
      requestedUrl,
      finalUrl: requestedUrl,
      method,
      status: 0,
      ok: false,
      headers: {},
      redirects,
      durationMs: response?.durationMs ?? 0,
      error,
      source: response?.source ?? 'live',
    };
    if (response?.fixtureId !== undefined) exchange.fixtureId = response.fixtureId;
    if (response?.recordedAt !== undefined) exchange.recordedAt = response.recordedAt;
    return exchange;
  }
}

/** Request-level memoisation: one network request per method+URL per audit. */
export class MemoTransport implements HttpTransport {
  private readonly cache = new Map<string, Promise<RawResponse>>();

  constructor(private readonly inner: HttpTransport) {}

  fetch(request: RawRequest): Promise<RawResponse> {
    const key = `${request.method} ${request.url}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const promise = this.inner.fetch(request);
    this.cache.set(key, promise);
    return promise;
  }
}

function resolveLocation(base: string, location: string): string | null {
  try {
    return new URL(location, base).href;
  } catch {
    return null;
  }
}

function safeHref(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}
