import { describe, expect, it, vi } from 'vitest';
import { ClientRegistry } from '../../src/shared-worker/ClientRegistry.js';
import {
  reportMetric,
  softCeilingMs,
  timeAsync,
} from './helpers.js';

const CLIENTS = 25;
const EVENTS = 100;

function createMockPort(): MessagePort {
  return {
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onmessageerror: null,
  } as unknown as MessagePort;
}

describe('perf: subscribe fan-out (multi-client)', () => {
  it('broadcasts changes to many subscribers within soft ceiling', async () => {
    const registry = new ClientRegistry();
    const ports: MessagePort[] = [];

    for (let i = 0; i < CLIENTS; i++) {
      const port = createMockPort();
      ports.push(port);
      const id = registry.register(port);
      registry.subscribe(id, 'todos');
    }

    // One client on another collection — must not receive todos events.
    const other = createMockPort();
    const otherId = registry.register(other);
    registry.subscribe(otherId, 'notes');

    const { ms } = await timeAsync(async () => {
      for (let i = 0; i < EVENTS; i++) {
        registry.broadcastChange({
          collection: 'todos',
          type: 'put',
          id: `id-${i}`,
          doc: {
            id: `id-${i}`,
            _version: 1,
            _updatedAt: i,
            title: `t${i}`,
          },
        });
      }
    });

    const deliveries = CLIENTS * EVENTS;
    const deliveriesPerSec = (deliveries / ms) * 1000;

    for (const port of ports) {
      expect(port.postMessage).toHaveBeenCalledTimes(EVENTS);
    }
    expect(other.postMessage).not.toHaveBeenCalled();

    reportMetric('subscribe_fanout', {
      clients: CLIENTS,
      events: EVENTS,
      deliveries,
      ms: Math.round(ms),
      deliveriesPerSec: Math.round(deliveriesPerSec),
    });

    expect(ms).toBeLessThan(softCeilingMs(2_000));
  });
});
