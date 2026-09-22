import {
  AuditError,
  DohResolver,
  FixtureDnsResolver,
  FixtureTransport,
  LiveTransport,
  normalizeTargetInput,
  runAudit,
  type AuditResult,
  type DnsResolver,
  type ExplanationProvider,
  type HttpTransport,
} from '@argus-audit/core';
import { listFixtures, resolveFixtureBundle } from './fixtures';
import { RateLimiter } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { createWorkersAiExplainer, DEFAULT_AI_MODEL } from './explain/workers-ai';
import { buildMethodology } from './methodology';
import type { GuardDecision } from './abuse-guard';

export { AbuseGuard } from './abuse-guard';

export interface Env {
  ASSETS?: Fetcher;
  ABUSE_GUARD?: DurableObjectNamespace;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  AUDIT_MODE?: string;
  AI_EXPLANATIONS?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
  TURNSTILE_SECRET?: string;
  /** Public Turnstile site key; safe to expose (it is rendered in the browser). */
  TURNSTILE_SITE_KEY?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  DAILY_AUDIT_CAP?: string;
}

const limiter = new RateLimiter(5, 60_000);
const MAX_CONCURRENT_AUDITS = 4;
let activeAudits = 0;

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    if (env.ASSETS !== undefined) {
      return env.ASSETS.fetch(request);
    }
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const cors = corsHeaders(env);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } });
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    const mode = auditMode(env);
    return json(
      {
        ok: true,
        mode,
        aiExplanations: env.AI_EXPLANATIONS === 'on' && env.AI !== undefined,
        turnstileSiteKey:
          env.TURNSTILE_SITE_KEY !== undefined && env.TURNSTILE_SITE_KEY.length > 0
            ? env.TURNSTILE_SITE_KEY
            : null,
        methodology: buildMethodology().methodologyVersion,
        fixtures: mode === 'fixture' ? listFixtures() : [],
      },
      200,
      cors,
    );
  }

  if (url.pathname === '/api/methodology' && request.method === 'GET') {
    return json({ ok: true, ...buildMethodology() }, 200, cors);
  }

  if (url.pathname === '/api/lab/fixtures' && request.method === 'GET') {
    return json({ ok: true, fixtures: listFixtures() }, 200, cors);
  }

  if (url.pathname === '/api/lab/audit' && request.method === 'POST') {
    return handleLabAudit(request, env, cors);
  }

  if (url.pathname === '/api/audit') {
    if (request.method !== 'POST') {
      return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405, cors);
    }
    return handleAudit(request, env, cors);
  }

  return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }, 404, cors);
}

async function handleAudit(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const requestHost = new URL(request.url).host;
  if (!isOriginAllowed(request.headers.get('origin'), requestHost, env.ALLOWED_ORIGIN)) {
    return json(
      { ok: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Cross-origin requests are not allowed.' } },
      403,
      cors,
    );
  }

  const guard = await checkAbuse(env, clientIp(request));
  if (!guard.allowed) {
    return guardRejection(guard, cors);
  }

  const parsed = await readBody(request, { requireAcknowledgement: true });
  if (!parsed.ok) {
    return json({ ok: false, error: { code: parsed.code, message: parsed.message } }, parsed.status, cors);
  }

  const mode = auditMode(env);
  let transport: HttpTransport;
  let dnsResolver: DnsResolver;
  if (mode === 'fixture') {
    const bundle = resolveBundleFor(parsed.value.url);
    if (bundle === null) {
      return json(
        {
          ok: false,
          error: {
            code: 'FIXTURE_NOT_FOUND',
            message: 'Demo mode only supports the bundled demo targets.',
            targets: listFixtures().map((fixture) => fixture.target),
          },
        },
        400,
        cors,
      );
    }
    transport = new FixtureTransport(bundle);
    dnsResolver = new FixtureDnsResolver(bundle.dns ?? [], bundle.id);
  } else {
    transport = new LiveTransport({ requestTimeoutMs: 10_000, maxBodyBytes: 524_288 });
    dnsResolver = new DohResolver();
  }

  return executeAudit(env, {
    target: parsed.value.url,
    transport,
    dnsResolver,
    mode,
    cors,
    turnstileToken: parsed.value.turnstileToken ?? '',
    ip: clientIp(request),
  });
}

async function handleLabAudit(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const guard = await checkAbuse(env, clientIp(request));
  if (!guard.allowed) {
    return guardRejection(guard, cors);
  }

  const parsed = await readBody(request, { requireAcknowledgement: false });
  if (!parsed.ok) {
    return json({ ok: false, error: { code: parsed.code, message: parsed.message } }, parsed.status, cors);
  }

  const bundle = resolveBundleFor(parsed.value.url);
  if (bundle === null) {
    return json(
      {
        ok: false,
        error: {
          code: 'FIXTURE_NOT_FOUND',
          message: 'The lab only replays the recorded fixtures.',
          targets: listFixtures().map((fixture) => fixture.target),
        },
      },
      400,
      cors,
    );
  }

  return executeAudit(env, {
    target: parsed.value.url,
    transport: new FixtureTransport(bundle),
    dnsResolver: new FixtureDnsResolver(bundle.dns ?? [], bundle.id),
    mode: 'fixture',
    cors,
    turnstileToken: '',
    ip: clientIp(request),
  });
}

interface AuditExecution {
  target: string;
  transport: HttpTransport;
  dnsResolver: DnsResolver;
  mode: 'live' | 'fixture';
  cors: Record<string, string>;
  turnstileToken: string;
  ip: string;
}

async function executeAudit(env: Env, execution: AuditExecution): Promise<Response> {
  if (env.TURNSTILE_SECRET !== undefined && env.TURNSTILE_SECRET.length > 0) {
    const verified = await verifyTurnstile(execution.turnstileToken, env.TURNSTILE_SECRET, execution.ip);
    if (!verified) {
      return json(
        { ok: false, error: { code: 'TURNSTILE_FAILED', message: 'Human verification failed. Reload and try again.' } },
        403,
        execution.cors,
      );
    }
  }

  const normalized = normalizeTargetInput(execution.target);
  if (!normalized.ok) {
    return json({ ok: false, error: { code: normalized.code, message: normalized.message } }, 400, execution.cors);
  }

  if (activeAudits >= MAX_CONCURRENT_AUDITS) {
    const response = json(
      { ok: false, error: { code: 'BUSY', message: 'The scanner is busy. Try again in a few seconds.' } },
      503,
      execution.cors,
    );
    response.headers.set('retry-after', '5');
    return response;
  }

  let explainer: ExplanationProvider | undefined;
  if (env.AI_EXPLANATIONS === 'on' && env.AI !== undefined) {
    explainer = createWorkersAiExplainer(env.AI, env.AI_MODEL ?? DEFAULT_AI_MODEL);
  }

  activeAudits += 1;
  try {
    const started = Date.now();
    const result: AuditResult = await runAudit({
      target: normalized.target.input,
      transport: execution.transport,
      dnsResolver: execution.dnsResolver,
      source: execution.mode === 'fixture' ? 'fixture' : 'live',
      ...(explainer === undefined ? {} : { explainer }),
    });
    return json({ ok: true, result, serverDurationMs: Date.now() - started }, 200, execution.cors);
  } catch (error) {
    if (error instanceof AuditError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, 400, execution.cors);
    }
    console.error('audit_failed', error instanceof Error ? error.message : 'unknown');
    return json(
      { ok: false, error: { code: 'AUDIT_FAILED', message: 'The audit could not be completed. Try again.' } },
      500,
      execution.cors,
    );
  } finally {
    activeAudits -= 1;
  }
}

export interface ParsedAuditRequest {
  url: string;
  turnstileToken?: string;
}

export type ParseResult =
  | { ok: true; value: ParsedAuditRequest }
  | { ok: false; code: string; message: string };

export function parseAuditRequest(
  rawBody: string,
  options: { requireAcknowledgement?: boolean } = {},
): ParseResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, code: 'INVALID_JSON', message: 'Request body must be JSON.' };
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_BODY', message: 'Expected a JSON object with a url field.' };
  }
  const record = body as Record<string, unknown>;
  const url = record['url'];
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { ok: false, code: 'URL_REQUIRED', message: 'Enter a website address.' };
  }
  if (options.requireAcknowledgement !== false && record['acknowledged'] !== true) {
    return {
      ok: false,
      code: 'ACKNOWLEDGEMENT_REQUIRED',
      message: 'Confirm that you are authorised to audit this website.',
    };
  }
  const token = record['turnstileToken'];
  const result: ParsedAuditRequest = { url: url.trim() };
  if (typeof token === 'string' && token.length > 0) result.turnstileToken = token;
  return { ok: true, value: result };
}

async function readBody(
  request: Request,
  options: { requireAcknowledgement: boolean },
): Promise<{ ok: true; value: ParsedAuditRequest } | { ok: false; code: string; message: string; status: number }> {
  const rawBody = await request.text();
  if (rawBody.length > 2048) {
    return { ok: false, code: 'BODY_TOO_LARGE', message: 'Request body too large.', status: 413 };
  }
  const parsed = parseAuditRequest(rawBody, options);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message, status: 400 };
  }
  return parsed;
}

/**
 * Explicit production origin policy: a browser origin is accepted only when it
 * matches the request host (same-origin SPA) or the configured ALLOWED_ORIGIN
 * (local development). Requests without an Origin header are allowed: those
 * are not browser cross-origin requests.
 */
export function isOriginAllowed(
  origin: string | null,
  requestHost: string,
  allowedOrigin?: string,
): boolean {
  if (origin === null || origin.length === 0) return true;
  if (allowedOrigin !== undefined && allowedOrigin.length > 0) {
    return origin === allowedOrigin;
  }
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

async function checkAbuse(env: Env, ip: string): Promise<GuardDecision & { source: 'durable' | 'memory' }> {
  const max = positiveInt(env.RATE_LIMIT_MAX, 5);
  const windowMs = positiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000);
  const dailyCap = positiveInt(env.DAILY_AUDIT_CAP, 500);

  if (env.ABUSE_GUARD !== undefined) {
    try {
      const stub = env.ABUSE_GUARD.get(env.ABUSE_GUARD.idFromName('global'));
      const response = await stub.fetch('https://abuse-guard/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip, max, windowMs, dailyCap }),
      });
      if (response.ok) {
        const decision = (await response.json()) as GuardDecision;
        return { ...decision, source: 'durable' };
      }
    } catch (error) {
      console.error('abuse_guard_unavailable', error instanceof Error ? error.message : 'unknown');
    }
  }

  // Fallback (local dev or DO outage): best-effort in-memory window.
  const fallback = limiter.check(ip);
  return {
    allowed: fallback.allowed,
    reason: fallback.allowed ? null : 'rate',
    retryAfterSeconds: fallback.retryAfterSeconds,
    remaining: fallback.remaining,
    dailyRemaining: -1,
    source: 'memory',
  };
}

function guardRejection(guard: GuardDecision, cors: Record<string, string>): Response {
  const message =
    guard.reason === 'daily_cap'
      ? 'The public audit budget for today is used up. Try again tomorrow.'
      : 'Too many audits from this address. Try again shortly.';
  const code = guard.reason === 'daily_cap' ? 'DAILY_CAP_REACHED' : 'RATE_LIMITED';
  const response = json({ ok: false, error: { code, message } }, 429, cors);
  response.headers.set('retry-after', String(Math.max(1, guard.retryAfterSeconds)));
  return response;
}

function resolveBundleFor(target: string) {
  const normalized = normalizeTargetInput(target);
  if (!normalized.ok) return null;
  return resolveFixtureBundle(normalized.target.httpsUrl);
}

function auditMode(env: Env): 'live' | 'fixture' {
  return env.AUDIT_MODE === 'fixture' ? 'fixture' : 'live';
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function corsHeaders(env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN;
  if (allowed === undefined || allowed.length === 0) return {};
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, cors?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...(cors ?? {}),
    },
  });
}
