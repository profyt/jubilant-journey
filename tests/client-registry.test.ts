import { describe, expect, it, vi } from 'vitest';
import { ClientRegistry } from '../src/shared-worker/ClientRegistry.js';

function createMockPort(): MessagePort {
  const listeners: Array<(event: MessageEvent) => void> = [];
  return {
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onmessageerror: null,
    set onmessage(handler: ((event: MessageEvent) => void) | null) {
      if (handler) listeners.push(handler);
    },
    get onmessage() {
      return listeners[listeners.length - 1] ?? null;
    },
  } as unknown as MessagePort;
}

describe('ClientRegistry', () => {
  it('registers clients and broadcasts to subscribers', () => {
    const registry = new ClientRegistry();
    const portA = createMockPort();
    const portB = createMockPort();
    const idA = registry.register(portA);
    const idB = registry.register(portB);

    registry.subscribe(idA, 'todos');
    registry.subscribe(idB, 'other');

    registry.broadcastChange({
      collection: 'todos',
      type: 'put',
      doc: { id: '1', _version: 1, _updatedAt: 1, title: 'x' },
      id: '1',
    });

    expect(portA.postMessage).toHaveBeenCalledOnce();
    expect(portB.postMessage).not.toHaveBeenCalled();
  });

  it('elects sync leader from syncCapable clients', () => {
    const registry = new ClientRegistry();
    const id = registry.register(createMockPort(), { syncCapable: true });
    registry.claimSyncLeader(id);
    expect(registry.getSyncLeader()?.clientId).toBe(id);
  });

  it('reassigns sync leader on unregister', () => {
    const registry = new ClientRegistry();
    const id1 = registry.register(createMockPort(), { syncCapable: true });
    const id2 = registry.register(createMockPort(), { syncCapable: true });
    registry.claimSyncLeader(id1);
    registry.unregister(id1);
    expect(registry.getSyncLeader()?.clientId).toBe(id2);
  });
});
