import { expect, test } from '@playwright/test';
import {
  applyReadmeSnippet,
  benchCall,
  buildSnippet,
  roundLatency,
  roundThroughput,
  waitBenchReady,
  writeArtifacts,
  type CrossTabResult,
  type EngineLatency,
  type EngineThroughput,
  type MarketingResults,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

const N_THROUGHPUT = 200;
const N_LATENCY = 50;
const N_FANOUT = 40;

/** Commit docs/README when regenerating locally (default). Skip in CI. */
const commitDocs = process.env.MARKETING_BENCH_COMMIT !== '0';

let results: MarketingResults | null = null;

test.afterAll(() => {
  if (!results) return;
  writeArtifacts(results, { commitDocs });
  if (commitDocs) {
    applyReadmeSnippet(buildSnippet(results));
  }
});

test('marketing: throughput & latency vs Dexie + cross-tab story', async ({
  browser,
  page,
  baseURL,
}) => {
  await page.goto('/marketing-bench.html');
  await waitBenchReady(page);
  await benchCall(page, 'reset');

  // Warmup — discard (JIT / IDB open path).
  await benchCall(page, 'wsdThroughput', 10);
  await benchCall(page, 'dexieThroughput', 10);
  await benchCall(page, 'reset');

  const wsdTp = roundThroughput(
    await benchCall<EngineThroughput>(page, 'wsdThroughput', N_THROUGHPUT),
  );
  await benchCall(page, 'reset');
  const dexieTp = roundThroughput(
    await benchCall<EngineThroughput>(page, 'dexieThroughput', N_THROUGHPUT),
  );
  await benchCall(page, 'reset');

  const wsdLat = roundLatency(
    await benchCall<EngineLatency>(page, 'wsdLatency', N_LATENCY),
  );
  await benchCall(page, 'reset');
  const dexieLat = roundLatency(
    await benchCall<EngineLatency>(page, 'dexieLatency', N_LATENCY),
  );

  // Structural checks only — never fail on ops/s variance.
  expect(wsdTp.putOpsPerSec).toBeGreaterThan(0);
  expect(dexieTp.putOpsPerSec).toBeGreaterThan(0);
  expect(wsdTp.queryCount).toBe(N_THROUGHPUT / 2);
  expect(dexieTp.queryCount).toBe(N_THROUGHPUT / 2);
  expect(wsdLat.putP50Ms).toBeGreaterThan(0);
  expect(dexieLat.putP50Ms).toBeGreaterThan(0);

  // Cross-tab fan-out (product story) — Dexie has no equivalent path.
  const context = await browser.newContext();
  const writer = await context.newPage();
  await writer.goto(`${baseURL}/marketing-bench.html`);
  await waitBenchReady(writer);
  const dbName = await writer.evaluate(() => window.__mktBench!.dbName);

  const reader = await context.newPage();
  await reader.goto(
    `${baseURL}/marketing-bench.html?db=${encodeURIComponent(dbName)}`,
  );
  await waitBenchReady(reader);
  await benchCall(reader, 'clearChangeCount');

  const wallStart = Date.now();
  for (let i = 0; i < N_FANOUT; i++) {
    await benchCall(writer, 'putOneWsd', `x-${i}`, `cross ${i}`);
  }
  const received = await benchCall<number>(
    reader,
    'waitChanges',
    N_FANOUT,
    30_000,
  );
  const wallMs = Date.now() - wallStart;
  await context.close();

  expect(received).toBeGreaterThanOrEqual(N_FANOUT);

  const crossTab: CrossTabResult = {
    engine: 'worker-sync-db',
    events: N_FANOUT,
    received,
    wallMs,
    eventsPerSec: Math.round((N_FANOUT / wallMs) * 1000),
  };

  // eslint-disable-next-line no-console
  console.info('[bench:marketing] throughput', JSON.stringify({ wsdTp, dexieTp }));
  // eslint-disable-next-line no-console
  console.info('[bench:marketing] latency', JSON.stringify({ wsdLat, dexieLat }));
  // eslint-disable-next-line no-console
  console.info('[bench:marketing] crossTab', JSON.stringify(crossTab));

  results = {
    generatedAt: new Date().toISOString(),
    environment: {
      browser: 'Chromium (Playwright Desktop Chrome)',
      note: 'Single machine run; absolute ops/s vary by CPU / load. Compare ratios on the same run.',
    },
    methodology: {
      summary:
        'Same Chromium process family, same document shape {id,title,kind}, sequential awaited put/get, one equality index query. worker-sync-db uses createDatabase mode=shared (SharedWorker → IndexedDB). Dexie uses main-thread IndexedDB (no worker, no multi-tab fan-out).',
      comparable: [
        'Single-tab CRUD throughput and latency on IndexedDB-backed stores',
        'Same N, same field shapes, same Chromium',
      ],
      notComparable: [
        'Multi-tab live subscribe (Dexie baseline has no SharedWorker path here)',
        'Remote sync / queue (not measured in this marketing suite)',
        'Across machines or CI vs laptop without re-running both sides together',
      ],
    },
    throughput: {
      workerSyncDb: wsdTp,
      dexie: dexieTp,
    },
    latency: {
      workerSyncDb: wsdLat,
      dexie: dexieLat,
    },
    crossTab,
  };
});
