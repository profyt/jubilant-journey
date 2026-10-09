import { beforeEach, describe, expect, it } from 'vitest';
import { DbEngine } from '../../src/shared-worker/DbEngine.js';
import {
  latencyStats,
  reportMetric,
  softCeilingMs,
  timeAsync,
} from './helpers.js';

const schema = {
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
} as const;

/** Keep N modest so CI stays fast and stable. */
const BULK_N = 300;
const LATENCY_N = 80;

describe('perf: DbEngine throughput & latency', () => {
  const engine = new DbEngine();

  beforeEach(async () => {
    await engine.init(`perf-db-${Math.random()}`, schema);
  });

  it('bulk put then get maintains throughput (report + soft ceiling)', async () => {
    const { ms: putMs } = await timeAsync(async () => {
      for (let i = 0; i < BULK_N; i++) {
        await engine.put(
          'todos',
          {
            id: `t-${i}`,
            title: `Todo ${i}`,
            status: i % 2 === 0 ? 'open' : 'done',
          },
          { enqueueSync: false },
        );
      }
    });

    const putOpsPerSec = (BULK_N / putMs) * 1000;
    reportMetric('bulk_put', {
      n: BULK_N,
      ms: Math.round(putMs),
      opsPerSec: Math.round(putOpsPerSec),
    });

    const { ms: getMs } = await timeAsync(async () => {
      for (let i = 0; i < BULK_N; i++) {
        const doc = await engine.get('todos', `t-${i}`);
        expect(doc?.id).toBe(`t-${i}`);
      }
    });

    const getOpsPerSec = (BULK_N / getMs) * 1000;
    reportMetric('bulk_get', {
      n: BULK_N,
      ms: Math.round(getMs),
      opsPerSec: Math.round(getOpsPerSec),
    });

    const { ms: queryMs, result: open } = await timeAsync(() =>
      engine.query({
        collection: 'todos',
        index: 'byStatus',
        range: { lower: 'open', upper: 'open' },
      }),
    );

    reportMetric('index_query', {
      n: open.length,
      ms: Math.round(queryMs),
    });

    expect(open.length).toBe(BULK_N / 2);
    // Soft: 300 puts should finish well under 15s even on slow CI.
    expect(putMs).toBeLessThan(softCeilingMs(15_000));
    expect(getMs).toBeLessThan(softCeilingMs(15_000));
    expect(queryMs).toBeLessThan(softCeilingMs(2_000));
  });

  it('single-op put/get latency p50/p95 (report + soft ceiling)', async () => {
    const putSamples: number[] = [];
    const getSamples: number[] = [];

    for (let i = 0; i < LATENCY_N; i++) {
      const id = `lat-${i}`;
      const { ms: putMs } = await timeAsync(() =>
        engine.put(
          'todos',
          { id, title: `L ${i}`, status: 'open' },
          { enqueueSync: false },
        ),
      );
      putSamples.push(putMs);

      const { ms: getMs } = await timeAsync(() => engine.get('todos', id));
      getSamples.push(getMs);
    }

    const put = latencyStats(putSamples);
    const get = latencyStats(getSamples);
    reportMetric('put_latency_ms', put);
    reportMetric('get_latency_ms', get);

    expect(put.count).toBe(LATENCY_N);
    expect(get.count).toBe(LATENCY_N);
    // Soft ceilings: catch multi-second single ops, not micro-jitter.
    expect(put.p95Ms).toBeLessThan(softCeilingMs(500));
    expect(get.p95Ms).toBeLessThan(softCeilingMs(500));
  });

  it('ops growth stays bounded under repeated mutations', async () => {
    const ROUNDS = 50;

    for (let i = 0; i < ROUNDS; i++) {
      await engine.put(
        'todos',
        { id: 'stable', title: `v${i}`, status: 'open' },
        { enqueueSync: false },
      );
    }
    expect(await engine.getPendingOps()).toHaveLength(0);

    for (let i = 0; i < ROUNDS; i++) {
      await engine.put('todos', {
        id: `q-${i}`,
        title: `queued ${i}`,
        status: 'open',
      });
    }
    const pending = await engine.getPendingOps();
    expect(pending).toHaveLength(ROUNDS);

    await engine.removePendingOps(pending.map((op) => op.opId));
    expect(await engine.getPendingOps()).toHaveLength(0);

    const doc = await engine.get('todos', 'stable');
    expect(doc?.title).toBe(`v${ROUNDS - 1}`);
    expect(doc?._version).toBe(ROUNDS);

    reportMetric('ops_growth_sanity', {
      updateRounds: ROUNDS,
      queueAfterLocalOnly: 0,
      queueAfterEnqueued: ROUNDS,
      queueAfterDrain: 0,
      finalVersion: doc?._version,
    });
  });
});
