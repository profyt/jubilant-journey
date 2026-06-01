# Getting started

## Install

```bash
npm install worker-sync-db
```

Peer dependency: TypeScript 5+ (for consumer type inference).

## Define a schema

A schema maps collection names to IndexedDB object stores:

```typescript
import type { CollectionSchema } from 'worker-sync-db';

export const schema = {
  todos: {
    keyPath: 'id',
    indexes: {
      byStatus: 'status',
    },
  },
  notes: {
    keyPath: 'id',
  },
} as const satisfies CollectionSchema;
```

- `keyPath` — primary key field on each document (usually `'id'`).
- `indexes` — optional named indexes for `query({ index: 'byStatus', range: ... })`.

Use `as const` so collection names are literal types in `db.put('todos', ...)`.

## Open a database

```typescript
import { createDatabase, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';
import { schema } from './schema';

const db = await createDatabase({
  schema,
  dbName: 'my-app', // SharedWorker.name + IndexedDB database name
  mode: 'auto',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
});
```

- **`dbName`** — must be stable across deploys for the same app; different apps should use different names.
- **`sharedWorker` / `dedicatedWorker`** — required in bundled apps so workers are emitted as separate files. See [bundlers.md](bundlers.md).

## CRUD

```typescript
// Create / update
const doc = await db.put('todos', {
  id: crypto.randomUUID(),
  title: 'Learn worker-sync-db',
  status: 'open',
});
console.log(doc._version, doc._updatedAt);

// Read
const todo = await db.get('todos', doc.id);

// Query by index
const open = await db.query('todos', {
  index: 'byStatus',
  range: IDBKeyRange.only('open'),
});

// Soft delete
await db.delete('todos', doc.id);
```

## Subscriptions (multi-tab)

```typescript
const unsub = db.subscribe('todos', (event) => {
  if (event.type === 'put') {
    console.log('Updated:', event.doc);
  } else {
    console.log('Deleted:', event.id);
  }
});

// Later
unsub();
```

Each tab must call `subscribe` locally. The SharedWorker broadcasts change events only to ports with an active subscription on that collection.

**Try it:** open your app in two browser tabs; add a todo in one tab — the other tab’s listener runs if it subscribed.

## Remote sync (optional)

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: new URL('worker-sync-db/shared-worker', import.meta.url),
  remote: myAdapter, // see sync.md
});

await db.syncNow();
db.onSyncStatusChange((status) => {
  console.log('Pending ops:', status.pending);
});
```

## Cleanup

```typescript
db.close();
```

Call when unmounting a SPA root or logging out. Other tabs keep their connections to the SharedWorker.

## Next steps

- [api.md](api.md) — full API
- [sync.md](sync.md) — backend contract
- [examples/vite-react-todos](../examples/vite-react-todos) — React demo
