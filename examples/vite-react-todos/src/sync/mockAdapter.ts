import type { RemoteChange, RemoteSyncAdapter } from 'worker-sync-db';

type StoredChange = {
  collection: string;
  doc: RemoteChange['doc'];
};

const serverDocs = new Map<string, StoredChange>();
let remoteSeq = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAdapter: RemoteSyncAdapter = {
  async pull(cursor) {
    await delay(220);
    const since = cursor ? Number(cursor) : 0;
    const changes: RemoteChange[] = [];

    for (const entry of serverDocs.values()) {
      if (entry.doc._updatedAt > since) {
        changes.push({
          collection: entry.collection,
          kind: entry.doc._deleted ? 'delete' : 'put',
          doc: { ...entry.doc },
        });
      }
    }

    const nextCursor = String(Date.now());
    return { changes, nextCursor };
  },

  async push(ops) {
    await delay(220);
    const applied: string[] = [];

    for (const op of ops) {
      const existing = serverDocs.get(op.doc.id);
      if (existing && existing.doc._updatedAt > op.doc._updatedAt) {
        continue;
      }
      serverDocs.set(op.doc.id, {
        collection: op.collection,
        doc: { ...op.doc },
      });
      applied.push(op.opId);
    }

    return { applied };
  },
};

/** Simulate a remote peer writing a todo that arrives on the next pull. */
export function seedRemoteTodo(title: string, agent = 'remote'): RemoteChange {
  remoteSeq += 1;
  const now = Date.now();
  const id = `remote-${now}-${remoteSeq}`;
  const doc = {
    id,
    title,
    status: 'open' as const,
    agent,
    _version: 1,
    _updatedAt: now,
  };
  const change: RemoteChange = {
    collection: 'todos',
    kind: 'put',
    doc,
  };
  serverDocs.set(id, { collection: 'todos', doc: { ...doc } });
  return change;
}

export function resetMockServer(): void {
  serverDocs.clear();
  remoteSeq = 0;
}

export function getServerSize(): number {
  return serverDocs.size;
}
