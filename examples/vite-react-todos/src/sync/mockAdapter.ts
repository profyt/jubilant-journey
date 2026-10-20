import type { RemoteChange, RemoteSyncAdapter } from 'worker-sync-db';

type StoredChange = {
  collection: string;
  doc: RemoteChange['doc'];
};

const serverDocs = new Map<string, StoredChange>();
let remoteSeq = 0;
/** When true, the next `push` returns conflicts for every op (demo UX). */
let armNextPushConflict = false;

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

    if (armNextPushConflict) {
      armNextPushConflict = false;
      return {
        applied: [],
        conflicts: ops.map((op) => ({
          opId: op.opId,
          reason: 'version mismatch (demo)',
        })),
      };
    }

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

/** Next `syncNow` push reports conflicts for all pending ops (inspect-only demo). */
export function armPushConflictDemo(): void {
  armNextPushConflict = true;
}

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

/**
 * Seed a remote revision of an existing local id so the next pull runs LWW
 * and emits `onConflict({ kind: 'lww', ... })`.
 */
export function seedRemoteRevision(options: {
  id: string;
  title: string;
  status?: 'open' | 'done';
  agent?: string;
  /** When true, remote is newer → `remote-applied`; else `local-wins`. */
  remoteWins: boolean;
  localUpdatedAt: number;
  localVersion: number;
}): RemoteChange {
  const delta = options.remoteWins ? 5_000 : -5_000;
  const doc = {
    id: options.id,
    title: options.title,
    status: options.status ?? 'open',
    agent: options.agent ?? 'orbit',
    _version: Math.max(1, options.localVersion + (options.remoteWins ? 1 : 0)),
    _updatedAt: options.localUpdatedAt + delta,
  };
  const change: RemoteChange = {
    collection: 'todos',
    kind: 'put',
    doc,
  };
  serverDocs.set(options.id, { collection: 'todos', doc: { ...doc } });
  return change;
}

export function resetMockServer(): void {
  serverDocs.clear();
  remoteSeq = 0;
}

export function getServerSize(): number {
  return serverDocs.size;
}
