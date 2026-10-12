import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  resolveCrossTabFallback,
  resolveWorkerMode,
} from '../src/client/createDatabase.js';
import {
  createCrossTabBroadcaster,
  crossTabChannelName,
} from '../src/client/crossTabBroadcast.js';

describe('resolveCrossTabFallback', () => {
  it('defaults auto to none in shared mode and BC in dedicated', () => {
    expect(resolveCrossTabFallback('shared', 'auto')).toBe('none');
    expect(resolveCrossTabFallback('dedicated', 'auto')).toBe(
      'broadcast-channel',
    );
  });

  it('respects explicit none / broadcast-channel', () => {
    expect(resolveCrossTabFallback('dedicated', 'none')).toBe('none');
    expect(resolveCrossTabFallback('shared', 'broadcast-channel')).toBe(
      'broadcast-channel',
    );
  });
});

describe('resolveWorkerMode', () => {
  const original = globalThis.SharedWorker;

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, 'SharedWorker');
    } else {
      globalThis.SharedWorker = original;
    }
  });

  it('auto falls back to dedicated when SharedWorker missing', () => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
    expect(resolveWorkerMode('auto')).toBe('dedicated');
  });
});

describe('createCrossTabBroadcaster', () => {
  type Stub = {
    name: string;
    onmessage: ((ev: MessageEvent) => void) | null;
    postMessage: (data: unknown) => void;
    close: () => void;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relays changes across channels and ignores echo', () => {
    const instances: Stub[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        name: string;
        onmessage: ((ev: MessageEvent) => void) | null = null;
        constructor(name: string) {
          this.name = name;
          instances.push(this);
        }
        postMessage(data: unknown) {
          for (const other of instances) {
            if (other === this || other.name !== this.name) continue;
            other.onmessage?.({ data } as MessageEvent);
          }
        }
        close() {
          const i = instances.indexOf(this);
          if (i >= 0) instances.splice(i, 1);
        }
      },
    );

    const received: string[] = [];
    const a = createCrossTabBroadcaster('db1', (p) => {
      received.push(`a:${p.id}`);
    });
    const b = createCrossTabBroadcaster('db1', (p) => {
      received.push(`b:${p.id}`);
    });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(crossTabChannelName('db1')).toBe('worker-sync-db:db1:changes');

    a!.publish({
      kind: 'change',
      collection: 'items',
      type: 'put',
      id: '1',
      doc: { id: '1', _version: 1, _updatedAt: 1 },
    });

    expect(received).toEqual(['b:1']);
    a!.close();
    b!.close();
  });
});
