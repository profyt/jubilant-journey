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
    await engine.init(`sync-test-${Math.random()}`, schema);
    remoteSync = new RemoteSync(engine, registry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs via fetch config', async () => {
    await engine.put('items', { id: '1', value: 'a' });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applied: [/* filled below */] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          changes: [],
          nextCursor: 'cursor-1',
        }),
      });

    const pending = await engine.getPendingOps();
    const opId = pending[0]!.opId;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applied: [opId] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    remoteSync.setConfig({
      kind: 'fetch',
      pullUrl: '/api/pull',
      pushUrl: '/api/push',
    });

    const status = await remoteSync.syncNow();
    expect(status.lastError).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
    expect(await engine.getCursor()).toBe('cursor-1');
  });
});
