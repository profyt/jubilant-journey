import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Perf / load suite is opted in via `npm run test:perf`.
    // Playwright e2e benches use `npm run bench:e2e`.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/perf/**', 'e2e/**'],
  },
});
