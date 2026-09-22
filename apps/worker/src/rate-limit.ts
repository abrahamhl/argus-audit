export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window limiter held in Worker isolate memory.
 *
 * This is deliberately best-effort: it protects a single isolate and is reset
 * on deploy or eviction. It is documented as such in docs/THREAT_MODEL.md; a
 * durable limiter (Durable Object / KV) is V0.3 work.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, nowMs = Date.now()): RateLimitDecision {
    const windowStart = nowMs - this.windowMs;
    const existing = this.hits.get(key) ?? [];
    const recent = existing.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.max) {
      const oldest = recent[0] ?? nowMs;
      const retryAfterMs = oldest + this.windowMs - nowMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    recent.push(nowMs);
    this.hits.set(key, recent);
    this.pruneIfLarge(nowMs);
    return { allowed: true, remaining: this.max - recent.length, retryAfterSeconds: 0 };
  }

  get trackedKeys(): number {
    return this.hits.size;
  }

  private pruneIfLarge(nowMs: number): void {
    if (this.hits.size <= 1024) return;
    const windowStart = nowMs - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter((timestamp) => timestamp > windowStart);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
