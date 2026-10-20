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
| `crossTabFallback` | `'auto' \| 'broadcast-channel' \| 'none'` | no | Default `'auto'`: in dedicated mode, relay live changes via `BroadcastChannel` |
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

### `putMany(collection, docs)`

```typescript
putMany<C extends keyof S & string>(
  collection: C,
  docs: Array<Record<string, unknown> & { id: string }>,
): Promise<InferDoc<S, C>[]>;
```

Upserts many documents in **one IndexedDB transaction**. Enqueues one sync op per doc when `remote` is set. Broadcasts a `put` change per document (same as `put`). Empty input → `[]`.

---

### `deleteMany(collection, ids)`

```typescript
deleteMany<C extends keyof S & string>(
  collection: C,
  ids: string[],
): Promise<InferDoc<S, C>[]>;
```

Soft-deletes the given ids in one transaction. **Missing ids are skipped** (no error). Returns the soft-deleted documents. Broadcasts a `delete` change per deleted id.

---

### `clear(collection)`

```typescript
clear<C extends keyof S & string>(collection: C): Promise<InferDoc<S, C>[]>;
```

Soft-deletes **all non-deleted** documents in the collection (same semantics as repeated `delete`). Returns the soft-deleted documents.

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
| `range` | `IDBKeyRangeInit`: both bounds → `only`/`bound`; only `lower` → `lowerBound`; only `upper` → `upperBound` |
| `limit` | Maximum number of results |
| `includeDeleted` | Include soft-deleted documents |

---

### `count(collection, opts?)`

```typescript
count<C extends keyof S & string>(
  collection: C,
  opts?: Omit<QueryOptions, 'limit'>,
): Promise<number>;
```

Returns how many documents match the same `index` / `range` / `includeDeleted` options as `query` (soft-deleted excluded by default). Prefer this over `query(...).length` for large collections.

---

### `subscribe(collection, listener, filter?)`

```typescript
subscribe<C extends keyof S & string>(
  collection: C,
  listener: (event: ChangeEvent<InferDoc<S, C>>) => void,
  filter?: { field: string; value: unknown },
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

Optional `filter` limits worker fan-out to puts where `doc[field] === value` (deletes are not delivered when a filter is set). The filter is taken from the **first** subscriber for that collection in the tab.

Also receives changes applied from remote `pull` (not only local multi-tab writes).

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
  /** Next debounced / backoff auto-sync (epoch ms), or null */
  nextSyncAt: number | null;
}
```

---

### `getDiagnostics()`

```typescript
getDiagnostics(): Promise<DatabaseDiagnostics>;
```

Read-only health snapshot:

| Field | Source |
|-------|--------|
| `workerMode` | Resolved `shared` / `dedicated` |
| `crossTabTransport` | `shared-worker` / `broadcast-channel` / `none` |
| `queueDepth` / `pending` | Sync queue length |
| `lastSyncAt` / `lastError` / `nextSyncAt` / `online` | Same as `getSyncStatus()` |

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

### `CollectionSchema` / `defineSchema` / `defineCollection`

```typescript
type CollectionDef<TDoc = Record<string, unknown>> = {
  keyPath: string;
  indexes?: Record<string, string>;
};

type CollectionSchema = Record<string, CollectionDef>;

function defineSchema<S extends CollectionSchema>(schema: S): S;

function defineCollection<TDoc extends Record<string, unknown>>(def: {
  keyPath: Extract<keyof TDoc, string>;
  indexes?: Record<string, Extract<keyof TDoc, string>>;
}): CollectionDef<TDoc>;

type InferDoc<S, C> = DocumentMeta & /* TDoc or Record<string, unknown> */;
type DocInput<S, C> = Omit<InferDoc<S, C>, '_version' | '_updatedAt' | '_deleted'> & {
  id: string;
};
```

Prefer `defineSchema({ todos: defineCollection<Todo>({ … }) })` so collection names **and** document fields flow into `DatabaseClient`.

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
| `WorkerDead` | SharedWorker / Worker failed to load |
| `SchemaMismatch` | Incompatible schema change for same `dbName` (e.g. `keyPath` change). Additive changes (new stores/indexes) migrate automatically. |
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
