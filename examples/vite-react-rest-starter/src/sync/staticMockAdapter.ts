import type { RemoteChange, RemoteSyncAdapter } from 'worker-sync-db';

/**
 * In-memory push/pull for static GitHub Pages (no Vite middleware).
 * Local `vite` / `vite preview` still use fetch URLs + mockSyncMiddleware.
 */
export function createStaticMockAdapter(): RemoteSyncAdapter {
  const serverDocs = new Map<string, RemoteChange['doc']>();

  return {
    async pull(cursor) {
      const since = cursor ? Number(cursor) : 0;
      const changes: RemoteChange[] = [];
      for (const doc of serverDocs.values()) {
        if (doc._updatedAt > since) {
          changes.push({
            collection: 'notes',
            kind: doc._deleted ? 'delete' : 'put',
            doc: { ...doc },
          });
        }
      }
      return { changes, nextCursor: String(Date.now()) };
    },
    async push(ops) {
      const applied: string[] = [];
      for (const op of ops) {
        const existing = serverDocs.get(op.doc.id);
        if (existing && existing._updatedAt > op.doc._updatedAt) {
          continue;
        }
        serverDocs.set(op.doc.id, { ...op.doc });
        applied.push(op.opId);
      }
      return { applied };
    },
  };
}
