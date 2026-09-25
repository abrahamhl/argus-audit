export interface WindowDecision {
  allowed: boolean;
  /** Hit timestamps inside the window, including the new hit when allowed. */
  hits: number[];
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Pure sliding-window evaluation shared by the Durable Object guard and the
 * in-memory fallback. Kept pure so it can be unit-tested without Workers.
 */
export function evaluateWindow(
  hits: readonly number[],
  nowMs: number,
  max: number,
  windowMs: number,
): WindowDecision {
  const windowStart = nowMs - windowMs;
  const recent = hits.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= max) {
    const oldest = recent[0] ?? nowMs;
    const retryAfterMs = oldest + windowMs - nowMs;
    return {
      allowed: false,
      hits: recent,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
    };
  }

  recent.push(nowMs);
  return { allowed: true, hits: recent, retryAfterSeconds: 0, remaining: max - recent.length };
}
