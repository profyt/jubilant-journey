import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ClientRegistry } from '../src/shared-worker/ClientRegistry.js';
import { DbEngine } from '../src/shared-worker/DbEngine.js';
import { RemoteSync } from '../src/shared-worker/RemoteSync.js';

const schema = { items: { keyPath: 'id' } } as const;

describe('RemoteSync', () => {
  const engine = new DbEngine();
  const registry = new ClientRegistry();
  let remoteSync: RemoteSync;

  beforeEach(async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    await engine.init(`sync-test-${Math.random()}`, schema);
    remoteSync = new RemoteSync(engine, registry);
  });

  afterEach(() => {
    remoteSync.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('syncs via fetch config and clears applied ops', async () => {
    await engine.put('items', { id: '1', value: 'a' });
    const pending = await engine.getPendingOps();
    const opId = pending[0]!.opId;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applied: [opId] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changes: [],
          nextCursor: 'cursor-1',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    const status = await remoteSync.syncNow();
    expect(status.lastError).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await engine.getCursor()).toBe('cursor-1');
    expect(await engine.getPendingOps()).toHaveLength(0);
  });

  it('broadcasts applied remote pull changes to subscribers', async () => {
    const port = {
      postMessage: vi.fn(),
    } as unknown as MessagePort;
    const clientId = registry.register(port);
    registry.subscribe(clientId, 'items');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            collection: 'items',
            kind: 'put',
            doc: {
              id: 'remote-1',
              value: 'from-server',
              _version: 1,
              _updatedAt: Date.now(),
            },
          },
        ],
        nextCursor: 'c2',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    await remoteSync.syncNow();

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'change',
        type: 'put',
        collection: 'items',
        id: 'remote-1',
      }),
    );
    expect(await engine.get('items', 'remote-1')).toMatchObject({
      value: 'from-server',
    });
  });

  it('hasConfig reflects setConfig', () => {
    expect(remoteSync.hasConfig()).toBe(false);
    remoteSync.setConfig({ kind: 'delegate' });
    expect(remoteSync.hasConfig()).toBe(true);
  });

  it('scheduleSync debounces before calling fetch', async () => {
    await engine.put('items', { id: '1', value: 'a' });
    const pending = await engine.getPendingOps();
    const opId = pending[0]!.opId;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applied: [opId] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], nextCursor: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setSchedulerOptions({ debounceMs: 200 });
    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    remoteSync.scheduleSync();
    remoteSync.scheduleSync();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(remoteSync.getStatus().nextSyncAt).not.toBeNull();

    await vi.advanceTimersByTimeAsync(200);
    // Flush the async runSync started by the timer.
    await Promise.resolve();
    await Promise.resolve();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(remoteSync.getStatus().nextSyncAt).toBeNull();
    expect(await engine.getPendingOps()).toHaveLength(0);
  });

  it('pauseSync stops auto schedule; syncNow still runs', async () => {
    await engine.put('items', { id: '1', value: 'a' });
    const pending = await engine.getPendingOps();
    const opId = pending[0]!.opId;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applied: [opId] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], nextCursor: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setSchedulerOptions({ debounceMs: 200 });
    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    remoteSync.pauseSync();
    expect(remoteSync.getStatus().paused).toBe(true);

    remoteSync.scheduleSync();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).not.toHaveBeenCalled();

    const status = await remoteSync.syncNow();
    expect(status.lastError).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    remoteSync.resumeSync();
    expect(remoteSync.getStatus().paused).toBe(false);
  });

  it('emits conflict events for fetch push conflicts', async () => {
    await engine.put('items', { id: '1', value: 'a' });
    const pending = await engine.getPendingOps();
    const opId = pending[0]!.opId;

    const port = { postMessage: vi.fn() } as unknown as MessagePort;
    registry.register(port);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Conflicted ops stay in the queue when omitted from `applied`.
          applied: [],
          conflicts: [{ opId, reason: 'version mismatch' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], nextCursor: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    await remoteSync.syncNow();

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conflict',
        conflict: { kind: 'push', opId, reason: 'version mismatch' },
      }),
    );
  });

  it('emits LWW inspect conflicts when pull skips or overwrites local', async () => {
    const { doc: local } = await engine.put(
      'items',
      { id: '1', value: 'local' },
      { enqueueSync: false },
    );

    const port = { postMessage: vi.fn() } as unknown as MessagePort;
    const clientId = registry.register(port);
    registry.subscribe(clientId, 'items');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            collection: 'items',
            kind: 'put',
            doc: {
              id: '1',
              value: 'older-remote',
              _version: 1,
              _updatedAt: local._updatedAt - 10_000,
            },
          },
          {
            collection: 'items',
            kind: 'put',
            doc: {
              id: '2',
              value: 'fresh',
              _version: 1,
              _updatedAt: local._updatedAt + 1,
            },
          },
        ],
        nextCursor: 'c-lww',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    await remoteSync.syncNow();

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conflict',
        conflict: expect.objectContaining({
          kind: 'lww',
          id: '1',
          outcome: 'local-wins',
          collection: 'items',
        }),
      }),
    );

    // Fresh id=2 has no local doc → no LWW inspect, just a change event.
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'change',
        id: '2',
        type: 'put',
      }),
    );

    // Overwrite path: remote newer than local
    port.postMessage.mockClear();
    const { doc: local3 } = await engine.put(
      'items',
      { id: '3', value: 'old-local' },
      { enqueueSync: false },
    );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changes: [
          {
            collection: 'items',
            kind: 'put',
            doc: {
              id: '3',
              value: 'newer-remote',
              _version: local3._version + 1,
              _updatedAt: local3._updatedAt + 5_000,
            },
          },
        ],
        nextCursor: 'c-lww-2',
      }),
    });
    await remoteSync.syncNow();
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conflict',
        conflict: expect.objectContaining({
          kind: 'lww',
          id: '3',
          outcome: 'remote-applied',
        }),
      }),
    );

    const after = await remoteSync.getPendingOps();
    expect(after).toHaveLength(1);
    expect(after[0]?.failedReason).toBe('version mismatch');
    expect(remoteSync.getStatus().failed).toBe(1);
    expect(remoteSync.getStatus().pending).toBe(1);

    const cleared = await remoteSync.discardFailedOps();
    expect(cleared.pending).toBe(0);
    expect(cleared.failed).toBe(0);
    expect(await remoteSync.getPendingOps()).toHaveLength(0);
  });

  it('discardPendingOps clears selected or all queue entries', async () => {
    await engine.put('items', { id: 'a', value: 1 });
    await engine.put('items', { id: 'b', value: 2 });
    const ops = await remoteSync.getPendingOps();
    expect(ops).toHaveLength(2);

    await remoteSync.discardPendingOps([ops[0]!.opId]);
    expect(await remoteSync.getPendingOps()).toHaveLength(1);

    await remoteSync.discardPendingOps();
    expect(await remoteSync.getPendingOps()).toHaveLength(0);
    expect(remoteSync.getStatus().pending).toBe(0);
  });

  it('schedules backoff after a failed syncNow', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await engine.put('items', { id: '1', value: 'a' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setSchedulerOptions({
      debounceMs: 50,
      baseBackoffMs: 1000,
      maxBackoffMs: 5000,
    });
    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const status = await remoteSync.syncNow();
    expect(status.lastError).toMatch(/Push failed/);
    expect(status.nextSyncAt).not.toBeNull();

    const callsAfterFail = fetchMock.mock.calls.length;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ applied: [], changes: [], nextCursor: null }),
    });

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await Promise.resolve();
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFail);
    });
  });
});
