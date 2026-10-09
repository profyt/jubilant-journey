import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BENCH_PORT ?? 4174);
const baseURL = `http://127.0.0.1:${port}`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Marketing-oriented Chromium benches (worker-sync-db vs Dexie).
 * Report-only: no soft ops/s ceilings that flake CI.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /marketing-bench\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  outputDir: path.join(repoRoot, 'test-results-marketing'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(repoRoot, 'marketing-bench-report.json') }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    cwd: repoRoot,
    command: `npm run build && npm run example:build && npm run preview --prefix examples/vite-react-todos -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/marketing-bench.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
