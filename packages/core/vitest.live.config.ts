import { defineConfig } from 'vitest/config';

// Live network tests are intentionally separate from deterministic CI.
// They only run when LIVE_AUDIT_TARGET is set (see src/live/audit.live.test.ts).
export default defineConfig({
  test: {
    include: ['src/live/**/*.live.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
