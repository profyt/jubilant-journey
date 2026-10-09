import { defineConfig } from 'vitest/config';

/**
 * Dedicated perf / load suite — not part of default `npm test`.
 * Soft ceilings + report-only metrics; override with PERF_MULTIPLIER if needed.
 */
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/perf/**/*.perf.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Sequential: shared fake-indexeddb + clearer metric logs.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
