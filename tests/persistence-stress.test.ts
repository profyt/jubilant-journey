import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientRegistry } from '../src/shared-worker/ClientRegistry.js';
import { DbEngine } from '../src/shared-worker/DbEngine.js';
import { RemoteSync } from '../src/shared-worker/RemoteSync.js';

const schema = {
  items: { keyPath: 'id' },
  notes: { keyPath: 'id' },
} as const;

/**
 * Persistence stress (#36): large queue, reopen mid-sync, soft quota-ish checks.
 * Uses fake-indexeddb (same as unit suite) — not a real browser quota probe.
 */
describe('persistence stress', () => {
  let engine: DbEngine;
  let registry: ClientRegistry;
  let remoteSync: RemoteSync;

  beforeEach(async () => {
    engine = new DbEngine();
    registry = new ClientRegistry();
    await engine.init(`stress-${Math.random()}`, schema);
    remoteSync = new RemoteSync(engine, registry, {
      debounceMs: 50,
      baseBackoffMs: 100,
      maxBackoffMs: 500,
    });
  });

  afterEach(() => {
    remoteSync.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('survives large pending queue then drains on syncNow', async () => {
    const N = 500;
    for (let i = 0; i < N; i++) {
      await engine.put('items', { id: `i-${i}`, n: i });
    }
    expect(await engine.getPendingOps()).toHaveLength(N);

    const applied = (await engine.getPendingOps()).map((o) => o.opId);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ applied }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ changes: [], nextCursor: 'c-large' }),
        }),
    );

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    const status = await remoteSync.syncNow();
    expect(status.lastError).toBeNull();
    expect(await engine.getPendingOps()).toHaveLength(0);
    expect(await engine.getCursor()).toBe('c-large');
    expect(await engine.count({ collection: 'items' })).toBe(N);
  });

  it('reopens same dbName and retains docs + pending ops (reload mid-sync)', async () => {
    const dbName = `reload-${Math.random()}`;
    await engine.init(dbName, schema);
    await engine.put('items', { id: 'keep', value: 1 });
    await engine.put('notes', { id: 'n1', body: 'hello' });
    const pendingBefore = await engine.getPendingOps();
    expect(pendingBefore.length).toBeGreaterThanOrEqual(2);

    // Simulate tab reload: new engine, same IndexedDB name
    const engine2 = new DbEngine();
    await engine2.init(dbName, schema);

    expect(await engine2.get('items', 'keep')).toMatchObject({ value: 1 });
    expect(await engine2.get('notes', 'n1')).toMatchObject({ body: 'hello' });
    expect(await engine2.getPendingOps()).toHaveLength(pendingBefore.length);

    // Mid-sync interruption: start sync that hangs on push, then reopen
    const remote2 = new RemoteSync(engine2, new ClientRegistry());
    remote2.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    let resolvePush!: (v: unknown) => void;
    const pushGate = new Promise((r) => {
      resolvePush = r;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('push') || String(url).includes('/api/push')) {
          await pushGate;
          return {
            ok: true,
            json: async () => ({
              applied: (await engine2.getPendingOps()).map((o) => o.opId),
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ changes: [], nextCursor: null }),
        };
      }),
    );

    const syncPromise = remote2.syncNow();
    // While sync is in flight, open a third engine (another tab/reload)
    const engine3 = new DbEngine();
    await engine3.init(dbName, schema);
    expect(await engine3.get('items', 'keep')).toMatchObject({ value: 1 });
    expect((await engine3.getPendingOps()).length).toBeGreaterThan(0);

    resolvePush({});
    await syncPromise;
    remote2.dispose();

    // After sync completes in engine2, engine3 sees drained queue on re-read
    const engine4 = new DbEngine();
    await engine4.init(dbName, schema);
    expect(await engine4.getPendingOps()).toHaveLength(0);
  });

  it('soft quota-ish: large payload batch does not throw StorageError casually', async () => {
    // Soft check: ~1MB of string payload across many docs (fake-idb has no real quota).
    const chunk = 'x'.repeat(2048);
    const docs = Array.from({ length: 200 }, (_, i) => ({
      id: `big-${i}`,
      blob: chunk,
    }));
    await expect(
      engine.putMany('items', docs, { enqueueSync: false }),
    ).resolves.toHaveLength(200);
    expect(await engine.count({ collection: 'items' })).toBe(200);
  });
});
