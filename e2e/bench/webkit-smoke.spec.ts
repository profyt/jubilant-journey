import { expect, test } from '@playwright/test';
import { benchCall, waitBenchReady } from './helpers.js';

/**
 * WebKit smoke (#49): hard CI gate after flake hardening.
 * SharedWorker may be unavailable; dedicated + BroadcastChannel is OK.
 */
test.describe.configure({ mode: 'serial' });

test('webkit: put/get via createDatabase', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'WebKit-only smoke');
  await page.goto('/bench.html');
  await waitBenchReady(page);

  await expect
    .poll(async () => page.evaluate(() => window.__wsdBench?.workerMode), {
      timeout: 15_000,
    })
    .toMatch(/^(shared|dedicated)$/);

  await benchCall(page, 'putOne', 'wk-1', 'webkit hello');
  await expect
    .poll(
      async () =>
        benchCall<{ id: string; title: string } | null>(page, 'getOne', 'wk-1'),
      { timeout: 15_000 },
    )
    .toEqual({ id: 'wk-1', title: 'webkit hello' });
});

test('webkit: cross-tab fan-out (shared or BC fallback)', async ({
  browser,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'webkit', 'WebKit-only smoke');
  const context = await browser.newContext();
  try {
    const writer = await context.newPage();
    await writer.goto(`${baseURL}/bench.html`, {
      waitUntil: 'domcontentloaded',
    });
    await waitBenchReady(writer);

    const mode = await writer.evaluate(() => window.__wsdBench!.workerMode);
    const transport = await writer.evaluate(
      () => window.__wsdBench!.crossTabTransport,
    );
    const dbName = await writer.evaluate(() => window.__wsdBench!.dbName);
    expect(['shared', 'dedicated']).toContain(mode);
    expect(['shared-worker', 'broadcast-channel', 'none']).toContain(transport);

    const reader = await context.newPage();
    await reader.goto(`${baseURL}/bench.html?db=${encodeURIComponent(dbName)}`, {
      waitUntil: 'domcontentloaded',
    });
    await waitBenchReady(reader);
    await benchCall(reader, 'clearChangeCount');

    await benchCall(writer, 'putOne', 'wk-cross', 'from writer');

    // Poll for fan-out — WebKit CI VMs can be slow; BC path is fine.
    await expect
      .poll(async () => benchCall<number>(reader, 'getChangeCount'), {
        timeout: 45_000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThanOrEqual(1);

    await expect
      .poll(
        async () =>
          benchCall<{ id: string; title: string } | null>(
            reader,
            'getOne',
            'wk-cross',
          ),
        { timeout: 15_000 },
      )
      .toEqual({ id: 'wk-cross', title: 'from writer' });

    // eslint-disable-next-line no-console
    console.info(
      `[webkit-smoke] workerMode=${mode} transport=${transport} dbName=${dbName}`,
    );
  } finally {
    await context.close();
  }
});
