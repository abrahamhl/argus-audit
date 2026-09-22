export interface Clock {
  nowMs(): number;
  nowIso(): string;
}

export const systemClock: Clock = {
  nowMs: () => Date.now(),
  nowIso: () => new Date().toISOString(),
};

/** Deterministic clock for tests and fixture runs. */
export function fixedClock(iso: string): Clock {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`fixedClock: invalid ISO date: ${iso}`);
  }
  return {
    nowMs: () => ms,
    nowIso: () => new Date(ms).toISOString(),
  };
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
