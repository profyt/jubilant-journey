import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BENCH_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Real-browser e2e benches (Chromium + SharedWorker + IndexedDB).
 * Soft ceilings only — not a micro-benchmark of Chrome IDB.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  outputDir: path.join(repoRoot, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(repoRoot, 'e2e-bench-report.json') }],
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
    // cwd must be repo root: Playwright defaults to the config directory.
    cwd: repoRoot,
    // Example deps must exist (see `npm run example:install` / CI). `--` after --prefix.
    command: `npm run build && npm run example:build && npm run preview --prefix examples/vite-react-todos -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/bench.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
