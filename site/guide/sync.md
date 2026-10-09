# Remote / BYO sync

worker-sync-db uses an **offline-first** model with optional bring-your-own backend sync.

1. `put` / `delete` write to IndexedDB immediately.
2. When `remote` is configured, each mutation is appended to `sync_queue` as a `PendingOp` (local-only DBs do not enqueue).
3. `syncNow()` (also scheduled after writes) pushes pending ops, then pulls remote changes.
4. Remote changes merge with **LWW** (last write wins) using `_updatedAt` and `_version`, then **broadcast** to subscribed tabs as `change` events.

Conflicts use last-write-wins on timestamps — no CRDT in v1.

## Delegate vs fetch

### Delegate mode (`RemoteSyncAdapter`)

Use when you need custom auth, retries, or non-REST protocols. Functions run on the **leader tab** (first connected tab with `syncCapable: true`). Other tabs only receive `SyncStatus` broadcasts.

```typescript
import { createDatabase, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';

const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
  remote: {
    async pull(cursor) {
      const res = await fetch(`/api/sync/pull?cursor=${cursor ?? ''}`);
      return res.json();
    },
    async push(ops) {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops }),
      });
      return res.json();
    },
  },
  onConflict: ({ opId, reason }) => {
    console.warn('Conflict', opId, reason);
  },
});
```

### Fetch mode (`FetchSyncConfig`)

Use for simple REST endpoints without custom client logic. HTTP runs inside the SharedWorker via `fetch()`.

```typescript
remote: {
  pullUrl: '/api/sync/pull',
  pushUrl: '/api/sync/push',
  headers: { Authorization: `Bearer ${token}` },
}
```

## Backend contract

### Push request body

```json
{
  "ops": [
    {
      "opId": "uuid",
      "collection": "todos",
      "kind": "put",
      "doc": {
        "id": "1",
        "title": "Milk",
        "status": "open",
        "_version": 2,
        "_updatedAt": 1717000000000
      }
    }
  ]
}
```

### Push response

```json
{
  "applied": ["opId-1", "opId-2"],
  "conflicts": [{ "opId": "opId-3", "reason": "version mismatch" }]
}
```

Applied `opId`s are removed from the local queue. Optional `conflicts` trigger `onConflict` on the leader tab (delegate mode).

### Pull response

```json
{
  "changes": [
    {
      "collection": "todos",
      "kind": "put",
      "doc": {
        "id": "1",
        "title": "Milk",
        "status": "done",
        "_version": 3,
        "_updatedAt": 1717000001000
      }
    }
  ],
  "nextCursor": "cursor-token-or-null"
}
```

`nextCursor` is stored in IndexedDB meta and sent on the next pull.

## SyncStatus

```typescript
db.onSyncStatusChange((status) => {
  console.log(status.pending, status.online, status.lastError);
});

await db.syncNow();
```

| Field | Meaning |
|-------|---------|
| `pending` | Ops waiting in sync queue |
| `lastSyncAt` | Timestamp of last successful sync |
| `lastError` | Last error message or null |
| `online` | `navigator.onLine` in worker |

## Mock adapter

The React example uses an in-memory adapter with artificial delay — see [`examples/vite-react-todos/src/sync/mockAdapter.ts`](https://github.com/profyt/jubilant-journey/blob/main/examples/vite-react-todos/src/sync/mockAdapter.ts) and try it in the [live demo](/demo/).
