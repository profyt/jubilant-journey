import { expect, test } from '@playwright/test';
import {
  benchCall,
  flushMetricsArtifact,
  recordMetric,
  softCeilingMs,
  waitBenchReady,
  type LatencyResult,
  type SyncBenchResult,
  type ThroughputResult,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  flushMetricsArtifact();
});

test('SharedWorker + IndexedDB throughput & latency', async ({ page }) => {
  await page.goto('/bench.html');
  await waitBenchReady(page);

  const mode = await page.evaluate(() => window.__wsdBench!.workerMode);
  expect(mode).toBe('shared');

  const throughput = await benchCall<ThroughputResult>(page, 'throughput', 120);
  recordMetric('throughput', {
    n: throughput.n,
    putMs: Math.round(throughput.putMs),
    getMs: Math.round(throughput.getMs),
    queryMs: Math.round(throughput.queryMs),
    putOpsPerSec: Math.round(throughput.putOpsPerSec),
    getOpsPerSec: Math.round(throughput.getOpsPerSec),
    queryCount: throughput.queryCount,
  });

  expect(throughput.queryCount).toBe(60);
  expect(throughput.putMs).toBeLessThan(softCeilingMs(45_000));
  expect(throughput.getMs).toBeLessThan(softCeilingMs(45_000));
  expect(throughput.queryMs).toBeLessThan(softCeilingMs(5_000));

  const latency = await benchCall<LatencyResult>(page, 'latency', 30);
  recordMetric('latency_ms', {
    n: latency.n,
    putP50Ms: Number(latency.putP50Ms.toFixed(3)),
    putP95Ms: Number(latency.putP95Ms.toFixed(3)),
    getP50Ms: Number(latency.getP50Ms.toFixed(3)),
    getP95Ms: Number(latency.getP95Ms.toFixed(3)),
  });

  expect(latency.putP95Ms).toBeLessThan(softCeilingMs(2_000));
  expect(latency.getP95Ms).toBeLessThan(softCeilingMs(2_000));
});

test('cross-tab subscribe fan-out via SharedWorker', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const writer = await context.newPage();
  await writer.goto(`${baseURL}/bench.html`);
  await waitBenchReady(writer);
  const dbName = await writer.evaluate(() => window.__wsdBench!.dbName);

  const reader = await context.newPage();
  await reader.goto(`${baseURL}/bench.html?db=${encodeURIComponent(dbName)}`);
  await waitBenchReady(reader);
  await benchCall(reader, 'clearChangeCount');

  const N = 25;
  for (let i = 0; i < N; i++) {
    await benchCall(writer, 'putOne', `x-${i}`, `cross ${i}`);
  }

  const received = await benchCall<number>(reader, 'waitChanges', N, 20_000);
  recordMetric('cross_tab_fanout', {
    events: N,
    received,
    dbName,
  });

  expect(received).toBeGreaterThanOrEqual(N);
  await context.close();
});

test('sync queue push/pull with fast mock remote', async ({ page }) => {
  await page.goto('/bench.html?remote=1');
  await waitBenchReady(page);

  const result = await benchCall<SyncBenchResult>(page, 'syncRoundtrip', 30);
  recordMetric('sync_roundtrip', {
    enqueued: result.enqueued,
    syncMs: Math.round(result.syncMs),
    pendingAfter: result.pendingAfter,
    pulled: result.pulled,
  });

  expect(result.pendingAfter).toBe(0);
  expect(result.syncMs).toBeLessThan(softCeilingMs(20_000));
});
