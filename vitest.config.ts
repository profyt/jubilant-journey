import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Perf / load suite is opted in via `npm run test:perf`.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/perf/**'],
  },
});
