import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
export const RESULTS_PATH = path.resolve(here, '../../e2e-bench-results.json');

export type BenchMetric = Record<string, unknown>;

export type ThroughputResult = {
  n: number;
  putMs: number;
  getMs: number;
  queryMs: number;
  putOpsPerSec: number;
  getOpsPerSec: number;
  queryCount: number;
};

export type LatencyResult = {
  n: number;
  putP50Ms: number;
  putP95Ms: number;
  getP50Ms: number;
  getP95Ms: number;
};

export type SyncBenchResult = {
  enqueued: number;
  syncMs: number;
  pendingAfter: number;
  pulled: number;
};

const metrics: BenchMetric[] = [];

export function softCeilingMs(baselineMs: number): number {
  const mult = Number(process.env.PERF_MULTIPLIER ?? process.env.BENCH_MULTIPLIER ?? '1');
  const safe = Number.isFinite(mult) && mult > 0 ? mult : 1;
  return baselineMs * safe;
}

export function recordMetric(name: string, value: BenchMetric): void {
  const row = { name, ...value, at: new Date().toISOString() };
  metrics.push(row);
  // eslint-disable-next-line no-console
  console.info(`[bench:e2e] ${name}`, JSON.stringify(value));
}

export function flushMetricsArtifact(): void {
  const summary = {
    generatedAt: new Date().toISOString(),
    metrics,
  };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2));
  // eslint-disable-next-line no-console
  console.info(`[bench:e2e] wrote ${RESULTS_PATH}`);
}

export async function waitBenchReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.body.dataset.benchReady === '1' &&
      typeof (window as unknown as { __wsdBench?: unknown }).__wsdBench !==
        'undefined',
    { timeout: 60_000 },
  );
}

export async function benchCall<T>(
  page: Page,
  fn: string,
  ...args: unknown[]
): Promise<T> {
  return page.evaluate(
    async ({ fn, args }) => {
      const api = (window as unknown as { __wsdBench: Record<string, Function> })
        .__wsdBench;
      return api[fn]!(...args) as T;
    },
    { fn, args },
  );
}
