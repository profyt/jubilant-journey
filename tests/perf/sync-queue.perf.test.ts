import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientRegistry } from '../../src/shared-worker/ClientRegistry.js';
import { DbEngine } from '../../src/shared-worker/DbEngine.js';
import { RemoteSync } from '../../src/shared-worker/RemoteSync.js';
import {
  reportMetric,
  softCeilingMs,
  timeAsync,
} from './helpers.js';

const schema = { items: { keyPath: 'id' } } as const;
const LOAD_N = 120;

describe('perf: sync queue under load (mock remote)', () => {
  const engine = new DbEngine();
  const registry = new ClientRegistry();
  let remoteSync: RemoteSync;

  beforeEach(async () => {
    await engine.init(`perf-sync-${Math.random()}`, schema);
    remoteSync = new RemoteSync(engine, registry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueues many puts then push/pull clears queue', async () => {
    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    const { ms: enqueueMs } = await timeAsync(async () => {
      for (let i = 0; i < LOAD_N; i++) {
        await engine.put('items', { id: `i-${i}`, value: i });
      }
    });

    const pending = await engine.getPendingOps();
    expect(pending).toHaveLength(LOAD_N);

    const appliedIds = pending.map((op) => op.opId);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applied: appliedIds }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changes: Array.from({ length: 20 }, (_, i) => ({
            collection: 'items',
            kind: 'put' as const,
            doc: {
              id: `remote-${i}`,
              value: `r${i}`,
              _version: 1,
              _updatedAt: Date.now() + i,
            },
          })),
          nextCursor: 'cursor-load',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const port = { postMessage: vi.fn() } as unknown as MessagePort;
    const clientId = registry.register(port);
    registry.subscribe(clientId, 'items');

    const { ms: syncMs } = await timeAsync(() => remoteSync.syncNow());

    expect(await engine.getPendingOps()).toHaveLength(0);
    expect(await engine.getCursor()).toBe('cursor-load');

    const postMessage = vi.mocked(port.postMessage);
    const changeDeliveries = postMessage.mock.calls.filter(
      ([msg]) =>
        msg &&
        typeof msg === 'object' &&
        (msg as { kind?: string }).kind === 'change',
    ).length;
    // syncNow also broadcasts syncStatus to all clients — count changes only.
    expect(changeDeliveries).toBe(20);
    expect(postMessage).toHaveBeenCalled();

    reportMetric('sync_queue_load', {
      enqueued: LOAD_N,
      enqueueMs: Math.round(enqueueMs),
      syncMs: Math.round(syncMs),
      remotePullApplied: 20,
      changeFanoutDeliveries: changeDeliveries,
      totalPortMessages: postMessage.mock.calls.length,
    });

    expect(enqueueMs).toBeLessThan(softCeilingMs(15_000));
    expect(syncMs).toBeLessThan(softCeilingMs(10_000));
  });
});
