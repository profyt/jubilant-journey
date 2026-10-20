import { expect, test } from '@playwright/test';
import { benchCall, waitBenchReady } from './helpers.js';

/**
 * Real-browser persistence / quota stress (#50).
 * CI-safe: moderate payload (~2–4 MiB), reopen same dbName, optional QuotaExceeded.
 */
test.describe.configure({ mode: 'serial' });

test('chromium: persist across reopen + moderate payload', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium real-IDB path');
  await page.goto('/bench.html');
  await waitBenchReady(page);

  const mode = await page.evaluate(() => window.__wsdBench!.workerMode);
  expect(['shared', 'dedicated']).toContain(mode);

  // ~2 MiB total (80 × 32 KiB) — enough to exercise IDB, not fill the disk.
  const count = 80;
  const bytesPerDoc = 32 * 1024;
  const write = await benchCall<{
    written: number;
    quotaExceeded: boolean;
    error?: string;
  }>(page, 'putManyPayload', count, bytesPerDoc);

  expect(write.written).toBeGreaterThan(0);
  if (write.quotaExceeded) {
    // Soft success: browser enforced quota without crashing the harness.
    expect(write.error).toBeTruthy();
    // eslint-disable-next-line no-console
    console.info(
      `[persistence-quota] QuotaExceeded after ${write.written} docs: ${write.error}`,
    );
  } else {
    expect(write.written).toBe(count);
  }

  const reopen = await benchCall<{
    ok: boolean;
    count: number;
    error?: string;
  }>(page, 'reopenSameDb');
  expect(reopen.ok).toBe(true);
  expect(reopen.count).toBeGreaterThanOrEqual(write.written);

  const sample = await benchCall<{ id: string; title: string } | null>(
    page,
    'getOne',
    'q-0',
  );
  if (write.written > 0 && !write.quotaExceeded) {
    expect(sample?.id).toBe('q-0');
    expect(sample?.title.length).toBe(bytesPerDoc);
  }
});

test('chromium: second page sees same dbName after writer close', async ({
  browser,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium real-IDB path');
  const context = await browser.newContext();
  try {
    const writer = await context.newPage();
    await writer.goto(`${baseURL}/bench.html`);
    await waitBenchReady(writer);
    const dbName = await writer.evaluate(() => window.__wsdBench!.dbName);

    await benchCall(writer, 'putOne', 'persist-1', 'across pages');
    await benchCall(writer, 'close');

    const reader = await context.newPage();
    await reader.goto(`${baseURL}/bench.html?db=${encodeURIComponent(dbName)}`);
    await waitBenchReady(reader);

    await expect
      .poll(
        async () =>
          benchCall<{ id: string; title: string } | null>(
            reader,
            'getOne',
            'persist-1',
          ),
        { timeout: 15_000 },
      )
      .toEqual({ id: 'persist-1', title: 'across pages' });
  } finally {
    await context.close();
  }
});
