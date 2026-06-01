import { describe, expect, it } from 'vitest';
import { ClientRegistry } from '../src/shared-worker/ClientRegistry.js';
import { DbEngine } from '../src/shared-worker/DbEngine.js';
import { MessageRouter } from '../src/shared-worker/MessageRouter.js';
import { RemoteSync } from '../src/shared-worker/RemoteSync.js';

const schema = {
  todos: { keyPath: 'id' },
} as const;

describe('MessageRouter', () => {
  it('handles connect and put over MessageChannel', async () => {
    const channel = new MessageChannel();
    const db = new DbEngine();
    const registry = new ClientRegistry();
    const remoteSync = new RemoteSync(db, registry);
    const router = new MessageRouter(db, registry, remoteSync);

    router.attach(channel.port1);

    const dbName = `router-test-${Math.random()}`;

    const connectResult = await sendRequest(channel.port2, {
      type: 'connect',
      dbName,
      schema,
      syncCapable: false,
    });

    expect(connectResult.clientId).toBeDefined();

    const doc = await sendRequest(channel.port2, {
      type: 'put',
      collection: 'todos',
      doc: { id: '1', title: 'Hello' },
    });

    expect(doc.title).toBe('Hello');

    const loaded = await sendRequest(channel.port2, {
      type: 'get',
      collection: 'todos',
      id: '1',
    });

    expect(loaded.title).toBe('Hello');
  });
});

function sendRequest(
  port: MessagePort,
  request: import('../src/shared/protocol.js').WorkerRequestInput,
): Promise<unknown> {
  const requestId = `req-${Math.random()}`;
  port.start();

  return new Promise((resolve, reject) => {
    port.onmessage = (event) => {
      const data = event.data;
      if (data?.kind === 'response' && data.requestId === requestId) {
        if (data.ok) resolve(data.data);
        else reject(data.error);
      }
    };
    port.postMessage({ ...request, requestId });
  });
}
