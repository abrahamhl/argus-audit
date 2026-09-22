import { evaluateWindow } from './abuse-window';

export interface GuardRequest {
  ip: string;
  max: number;
  windowMs: number;
  dailyCap: number;
}

export interface GuardDecision {
  allowed: boolean;
  reason: 'rate' | 'daily_cap' | null;
  retryAfterSeconds: number;
  remaining: number;
  dailyRemaining: number;
}

/**
 * Durable Object holding the global abuse counters.
 *
 * One named instance ("global") serialises checks, so the sliding window and
 * the daily audit cap survive isolate eviction and deployments. Storage uses
 * the SQLite-backed KV API, which is available on the Workers free plan.
 */
export class AbuseGuard {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const payload = (await request.json()) as GuardRequest;
    const now = Date.now();
    const dayKey = `day:${new Date(now).toISOString().slice(0, 10)}`;

    const hits = (await this.state.storage.get<number[]>(`ip:${payload.ip}`)) ?? [];
    const decision = evaluateWindow(hits, now, payload.max, payload.windowMs);
    const usedToday = (await this.state.storage.get<number>(dayKey)) ?? 0;

    const response = (body: GuardDecision): Response =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    if (decision.allowed && usedToday >= payload.dailyCap) {
      return response({
        allowed: false,
        reason: 'daily_cap',
        retryAfterSeconds: 3600,
        remaining: 0,
        dailyRemaining: 0,
      });
    }

    if (!decision.allowed) {
      return response({
        allowed: false,
        reason: 'rate',
        retryAfterSeconds: decision.retryAfterSeconds,
        remaining: 0,
        dailyRemaining: Math.max(0, payload.dailyCap - usedToday),
      });
    }

    await this.state.storage.put(`ip:${payload.ip}`, decision.hits);
    await this.state.storage.put(dayKey, usedToday + 1);

    return response({
      allowed: true,
      reason: null,
      retryAfterSeconds: 0,
      remaining: decision.remaining,
      dailyRemaining: Math.max(0, payload.dailyCap - usedToday - 1),
    });
  }
}
