import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BENCH_PORT ?? 4174);
const baseURL = `http://127.0.0.1:${port}`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Soft WebKit smoke (#35). Separate from Chromium hard-gate benches.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /webkit-smoke\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  outputDir: path.join(repoRoot, 'test-results-webkit'),
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    cwd: repoRoot,
    command: `npm run build && npm run example:build && npm run preview --prefix examples/vite-react-todos -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/bench.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
