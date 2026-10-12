import { describe, expect, it, beforeEach } from 'vitest';
import { describeSchemaChange } from '../src/shared/schema.js';
import { DbEngine } from '../src/shared-worker/DbEngine.js';
import { ClientRegistry } from '../src/shared-worker/ClientRegistry.js';
import { MessageRouter } from '../src/shared-worker/MessageRouter.js';
import { RemoteSync } from '../src/shared-worker/RemoteSync.js';

describe('describeSchemaChange', () => {
  it('marks identical schemas', () => {
    const s = { todos: { keyPath: 'id' } };
    expect(describeSchemaChange(s, s).kind).toBe('identical');
  });

  it('allows adding an index', () => {
    const prev = { todos: { keyPath: 'id' } };
    const next = {
      todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
    };
    expect(describeSchemaChange(prev, next).kind).toBe('compatible');
  });

  it('rejects keyPath changes', () => {
    const prev = { todos: { keyPath: 'id' } };
    const next = { todos: { keyPath: 'todoId' } };
    const result = describeSchemaChange(prev, next);
    expect(result.kind).toBe('incompatible');
    expect(result.detail).toMatch(/keyPath changed/);
  });
});

describe('DbEngine schema migration', () => {
  const engine = new DbEngine();

  beforeEach(async () => {
    // fresh name per test
  });

  it('upgrades when adding an index and keeps data', async () => {
    const dbName = `migrate-${Math.random()}`;
    await engine.init(dbName, {
      todos: { keyPath: 'id' },
    });
    await engine.put(
      'todos',
      { id: '1', title: 'A', status: 'open' },
      { enqueueSync: false },
    );

    await engine.init(dbName, {
      todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
    });

    const open = await engine.query({
      collection: 'todos',
      index: 'byStatus',
      range: { lower: 'open', upper: 'open' },
    });
    expect(open).toHaveLength(1);
    expect(open[0]?.title).toBe('A');
  });
});

describe('MessageRouter schema migration', () => {
  it('rejects incompatible schema on reconnect', async () => {
    const channel = new MessageChannel();
    const db = new DbEngine();
    const registry = new ClientRegistry();
    const remoteSync = new RemoteSync(db, registry);
    const router = new MessageRouter(db, registry, remoteSync);
    router.attach(channel.port1);

    const dbName = `router-migrate-${Math.random()}`;
    await sendRequest(channel.port2, {
      type: 'connect',
      dbName,
      schema: { todos: { keyPath: 'id' } },
      syncCapable: false,
    });

    await expect(
      sendRequest(channel.port2, {
        type: 'connect',
        dbName,
        schema: { todos: { keyPath: 'other' } },
        syncCapable: false,
      }),
    ).rejects.toMatchObject({ code: 'SchemaMismatch' });
  });

  it('accepts compatible schema upgrade on reconnect', async () => {
    const channel = new MessageChannel();
    const db = new DbEngine();
    const registry = new ClientRegistry();
    const remoteSync = new RemoteSync(db, registry);
    const router = new MessageRouter(db, registry, remoteSync);
    router.attach(channel.port1);

    const dbName = `router-migrate-ok-${Math.random()}`;
    await sendRequest(channel.port2, {
      type: 'connect',
      dbName,
      schema: { todos: { keyPath: 'id' } },
      syncCapable: false,
    });

    await sendRequest(channel.port2, {
      type: 'put',
      collection: 'todos',
      doc: { id: '1', title: 'Hi', status: 'open' },
    });

    await sendRequest(channel.port2, {
      type: 'connect',
      dbName,
      schema: {
        todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
      },
      syncCapable: false,
    });

    const rows = await sendRequest(channel.port2, {
      type: 'query',
      collection: 'todos',
      index: 'byStatus',
      range: { lower: 'open', upper: 'open' },
    });
    expect(rows).toHaveLength(1);
  });
});

function sendRequest(
  port: MessagePort,
  request: Record<string, unknown>,
): Promise<unknown> {
  const requestId = `${Date.now()}-${Math.random()}`;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as {
        kind?: string;
        requestId?: string;
        ok?: boolean;
        data?: unknown;
        error?: { code: string; message: string };
      };
      if (msg.kind !== 'response' || msg.requestId !== requestId) return;
      port.removeEventListener('message', onMessage);
      if (msg.ok) resolve(msg.data);
      else reject(msg.error ?? new Error('request failed'));
    };
    port.addEventListener('message', onMessage);
    port.start();
    port.postMessage({ ...request, requestId });
  });
}
