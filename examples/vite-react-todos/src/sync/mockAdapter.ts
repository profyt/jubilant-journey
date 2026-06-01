import type { RemoteChange, RemoteSyncAdapter } from 'worker-sync-db';

const serverDocs = new Map<string, RemoteChange['doc']>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAdapter: RemoteSyncAdapter = {
  async pull(cursor) {
    await delay(300);
    const since = cursor ? Number(cursor) : 0;
    const changes: RemoteChange[] = [];

    for (const doc of serverDocs.values()) {
      if (doc._updatedAt > since) {
        changes.push({
          collection: 'todos',
          kind: doc._deleted ? 'delete' : 'put',
          doc: { ...doc },
        });
      }
    }

    const nextCursor = String(Date.now());
    return { changes, nextCursor };
  },

  async push(ops) {
    await delay(300);
    const applied: string[] = [];

    for (const op of ops) {
      const existing = serverDocs.get(op.doc.id);
      if (
        existing &&
        existing._updatedAt > op.doc._updatedAt
      ) {
        continue;
      }
      serverDocs.set(op.doc.id, { ...op.doc });
      applied.push(op.opId);
    }

    return { applied };
  },
};

export function resetMockServer(): void {
  serverDocs.clear();
}

export function getServerSize(): number {
  return serverDocs.size;
}
