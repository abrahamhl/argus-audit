import {
  AuditError,
  LiveTransport,
  FixtureTransport,
  normalizeTargetInput,
  runAudit,
  type AuditResult,
  type ExplanationProvider,
} from '@argus-audit/core';
import { listFixtures, resolveFixtureBundle } from './fixtures';
import { RateLimiter } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { createWorkersAiExplainer, DEFAULT_AI_MODEL } from './explain/workers-ai';

export interface Env {
  ASSETS?: Fetcher;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  AUDIT_MODE?: string;
  AI_EXPLANATIONS?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
  TURNSTILE_SECRET?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_MS?: string;
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
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404, env);
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const cors = corsHeaders(request, env);
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
        methodology: '0.1.0',
        fixtures: mode === 'fixture' ? listFixtures() : [],
      },
      200,
      env,
      cors,
    );
  }

  if (url.pathname === '/api/audit') {
    if (request.method !== 'POST') {
      return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405, env, cors);
    }
    return handleAudit(request, env, cors);
  }

  return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }, 404, env, cors);
}

async function handleAudit(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const originCheck = checkOrigin(request, env);
  if (originCheck !== null) {
    return json({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: originCheck } }, 403, env, cors);
  }

  const ip = clientIp(request);
  const limit = limiter.check(ip);
  if (!limit.allowed) {
    const response = json(
      { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many audits from this address. Try again shortly.' } },
      429,
      env,
      cors,
    );
    response.headers.set('retry-after', String(limit.retryAfterSeconds));
    return response;
  }

  const rawBody = await request.text();
  if (rawBody.length > 2048) {
    return json({ ok: false, error: { code: 'BODY_TOO_LARGE', message: 'Request body too large.' } }, 413, env, cors);
  }

  const parsed = parseAuditRequest(rawBody);
  if (!parsed.ok) {
    return json({ ok: false, error: { code: parsed.code, message: parsed.message } }, 400, env, cors);
  }

  if (env.TURNSTILE_SECRET !== undefined && env.TURNSTILE_SECRET.length > 0) {
    const token = parsed.value.turnstileToken ?? '';
    const verified = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
    if (!verified) {
      return json(
        { ok: false, error: { code: 'TURNSTILE_FAILED', message: 'Human verification failed. Reload and try again.' } },
        403,
        env,
        cors,
      );
    }
  }

  const normalized = normalizeTargetInput(parsed.value.url);
  if (!normalized.ok) {
    return json({ ok: false, error: { code: normalized.code, message: normalized.message } }, 400, env, cors);
  }

  const mode = auditMode(env);
  let transport;
  if (mode === 'fixture') {
    const bundle = resolveFixtureBundle(normalized.target.httpsUrl);
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
        env,
        cors,
      );
    }
    transport = new FixtureTransport(bundle);
  } else {
    transport = new LiveTransport({ requestTimeoutMs: 10_000, maxBodyBytes: 524_288 });
  }

  if (activeAudits >= MAX_CONCURRENT_AUDITS) {
    const response = json(
      { ok: false, error: { code: 'BUSY', message: 'The scanner is busy. Try again in a few seconds.' } },
      503,
      env,
      cors,
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
      transport,
      source: mode === 'fixture' ? 'fixture' : 'live',
      ...(explainer === undefined ? {} : { explainer }),
    });
    return json({ ok: true, result, serverDurationMs: Date.now() - started }, 200, env, cors);
  } catch (error) {
    if (error instanceof AuditError) {
      return json({ ok: false, error: { code: error.code, message: error.message } }, 400, env, cors);
    }
    console.error('audit_failed', error instanceof Error ? error.message : 'unknown');
    return json(
      { ok: false, error: { code: 'AUDIT_FAILED', message: 'The audit could not be completed. Try again.' } },
      500,
      env,
      cors,
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

export function parseAuditRequest(rawBody: string): ParseResult {
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
  const token = record['turnstileToken'];
  const result: ParsedAuditRequest = { url: url.trim() };
  if (typeof token === 'string' && token.length > 0) result.turnstileToken = token;
  return { ok: true, value: result };
}

function auditMode(env: Env): 'live' | 'fixture' {
  return env.AUDIT_MODE === 'fixture' ? 'fixture' : 'live';
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function checkOrigin(request: Request, env: Env): string | null {
  const allowed = env.ALLOWED_ORIGIN;
  if (allowed === undefined || allowed.length === 0) return null;
  const origin = request.headers.get('origin');
  if (origin === null) return null;
  return origin === allowed ? null : `Origin ${origin} is not allowed.`;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN;
  if (allowed === undefined || allowed.length === 0) return {};
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, env: Env, cors?: Record<string, string>): Response {
  void env;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...(cors ?? {}),
    },
  });
}
