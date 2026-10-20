import { expect, test } from '@playwright/test';
import { benchCall, waitBenchReady } from './helpers.js';

/**
 * WebKit smoke (#35): soft CI gate — basic IndexedDB path + best-effort cross-tab.
 * SharedWorker may be unavailable in some WebKit builds; dedicated + BC is OK.
 */
test.describe.configure({ mode: 'serial' });

test('webkit: put/get via createDatabase', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'WebKit-only smoke');
  await page.goto('/bench.html');
  await waitBenchReady(page);

  const mode = await page.evaluate(() => window.__wsdBench!.workerMode);
  expect(['shared', 'dedicated']).toContain(mode);

  await benchCall(page, 'putOne', 'wk-1', 'webkit hello');
  const doc = await benchCall<{ id: string; title: string } | null>(
    page,
    'getOne',
    'wk-1',
  );
  expect(doc).toEqual({ id: 'wk-1', title: 'webkit hello' });
});

test('webkit: cross-tab fan-out (shared or BC fallback)', async ({
  browser,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'webkit', 'WebKit-only smoke');
  const context = await browser.newContext();
  const writer = await context.newPage();
  await writer.goto(`${baseURL}/bench.html`);
  await waitBenchReady(writer);

  const mode = await writer.evaluate(() => window.__wsdBench!.workerMode);
  const dbName = await writer.evaluate(() => window.__wsdBench!.dbName);

  const reader = await context.newPage();
  await reader.goto(`${baseURL}/bench.html?db=${encodeURIComponent(dbName)}`);
  await waitBenchReady(reader);
  await benchCall(reader, 'clearChangeCount');

  await benchCall(writer, 'putOne', 'wk-cross', 'from writer');

  // Soft: allow slower fan-out on WebKit CI VMs
  const received = await benchCall<number>(reader, 'waitChanges', 1, 30_000);
  const last = await benchCall<{ id: string; title: string } | null>(
    reader,
    'getOne',
    'wk-cross',
  );

  expect(received).toBeGreaterThanOrEqual(1);
  expect(last).toEqual({ id: 'wk-cross', title: 'from writer' });
  // Document which path we got for CI logs
  // eslint-disable-next-line no-console
  console.info(`[webkit-smoke] workerMode=${mode} dbName=${dbName}`);
  await context.close();
});
