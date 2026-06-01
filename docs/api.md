# API reference

## `createDatabase(options)`

```typescript
function createDatabase<S extends CollectionSchema>(
  options: CreateDatabaseOptions<S>,
): Promise<DatabaseClient<S>>;
```

### `CreateDatabaseOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `schema` | `S extends CollectionSchema` | yes | Collection definitions |
| `dbName` | `string` | yes | SharedWorker name + IndexedDB name |
| `sharedWorker` | `string \| URL` | recommended | URL to shared-worker bundle |
| `dedicatedWorker` | `string \| URL` | recommended | URL to dedicated-worker bundle |
| `mode` | `'auto' \| 'shared' \| 'dedicated'` | no | Default `'auto'` |
| `remote` | `RemoteSyncAdapter \| FetchSyncConfig` | no | Enables sync |
| `onConflict` | `(conflict) => void` | no | Push conflicts (delegate adapter) |

Throws if `window` is undefined (SSR).

### Worker URL exports

```typescript
import { sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';
```

`URL` objects pointing at `dist/shared-worker/entry.js` and `dist/dedicated-worker/entry.js`. Used as defaults when `sharedWorker` / `dedicatedWorker` are omitted.

---

## `DatabaseClient<S>`

### `get(collection, id)`

```typescript
get<C extends keyof S & string>(
  collection: C,
  id: string,
): Promise<InferDoc<S, C> | null>;
```

Returns the document or `null` if missing or soft-deleted.

---

### `put(collection, doc)`

```typescript
put<C extends keyof S & string>(
  collection: C,
  doc: Record<string, unknown> & { id: string },
): Promise<InferDoc<S, C>>;
```

Upserts a document. Adds `_version`, `_updatedAt`. Enqueues a sync op when `remote` is set. Notifies all subscribed tabs.

---

### `delete(collection, id)`

```typescript
delete<C extends keyof S & string>(
  collection: C,
  id: string,
): Promise<InferDoc<S, C>>;
```

Soft-deletes (`_deleted: true`). Returns the updated document or throws `NotFound`.

---

### `query(collection, opts?)`

```typescript
query<C extends keyof S & string>(
  collection: C,
  opts?: QueryOptions,
): Promise<InferDoc<S, C>[]>;
```

| `QueryOptions` | Description |
|----------------|-------------|
| `index` | Index name from schema |
| `range` | `IDBKeyRangeInit` (`lower`, `upper`, `lowerOpen`, `upperOpen`) |
| `limit` | Maximum number of results |
| `includeDeleted` | Include soft-deleted documents |

---

### `subscribe(collection, listener)`

```typescript
subscribe<C extends keyof S & string>(
  collection: C,
  listener: (event: ChangeEvent<InferDoc<S, C>>) => void,
): () => void;
```

`ChangeEvent`:

```typescript
{
  type: 'put' | 'delete';
  collection: string;
  doc: T | null;  // null on delete
  id: string;
}
```

Returns an unsubscribe function. Register in every tab that should receive live updates.

---

### `syncNow()`

```typescript
syncNow(): Promise<SyncStatus>;
```

Pushes pending operations, then pulls remote changes. No-op queue flush if `remote` is not configured.

---

### `getSyncStatus()`

```typescript
getSyncStatus(): Promise<SyncStatus>;
```

```typescript
interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  online: boolean;
}
```

---

### `onSyncStatusChange(listener)`

```typescript
onSyncStatusChange(listener: (status: SyncStatus) => void): () => void;
```

Fired when sync status changes (including after `put` / `delete` refresh pending count).

---

### `close()`

```typescript
close(): void;
```

Sends `disconnect`, closes the port, rejects in-flight RPCs.

---

## Types

### `CollectionSchema`

```typescript
type CollectionSchema = Record<
  string,
  { keyPath: string; indexes?: Record<string, string> }
>;
```

### `DocumentMeta`

```typescript
interface DocumentMeta {
  id: string;
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
}
```

### `RemoteSyncAdapter`

```typescript
interface RemoteSyncAdapter {
  pull(cursor: string | null): Promise<{
    changes: RemoteChange[];
    nextCursor: string | null;
  }>;
  push(ops: PendingOp[]): Promise<{
    applied: string[];
    conflicts?: Conflict[];
  }>;
}
```

### `FetchSyncConfig`

```typescript
interface FetchSyncConfig {
  pullUrl: string;
  pushUrl: string;
  headers?: Record<string, string>;
}
```

---

## Errors

`DatabaseError` with `code`:

| Code | Meaning |
|------|---------|
| `NotFound` | Document missing on delete |
| `SchemaMismatch` | Different schema for same `dbName` |
| `NotConnected` | Port closed |
| `Timeout` | RPC exceeded timeout (default 30s) |
| `InvalidRequest` | Unknown request or aborted |
| `StorageError` | IndexedDB / sync failure |

---

## Low-level API

For advanced integration without `createDatabase`:

- `connectSharedWorker(options)` → `PortBridge`
- `connectDedicatedWorker(options)` → `PortBridge`
- `PortBridge.call(request)` — typed RPC
- `PortBridge.onEvent(listener)` — worker events

See `src/client/PortBridge.ts` and `src/shared/protocol.ts`.
