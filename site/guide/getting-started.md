# Getting started

Install from npm, define a schema, open a database, and start reading and writing.

## Install

```bash
npm install worker-sync-db
```

Peer: **TypeScript 5+** (for types). Install **React 18+** only if you use [`worker-sync-db/react`](/guide/react).

Package: [`worker-sync-db` on npm](https://www.npmjs.com/package/worker-sync-db).

## Define a schema

A schema maps collection names to IndexedDB object stores:

```typescript
import { defineSchema } from 'worker-sync-db';

export const schema = defineSchema({
  todos: {
    keyPath: 'id',
    indexes: {
      byStatus: 'status',
    },
  },
  notes: {
    keyPath: 'id',
  },
});
```

- `keyPath` — primary key field on each document (usually `'id'`).
- `indexes` — optional named indexes for `query({ index: 'byStatus', range: ... })`.

`defineSchema` preserves literal collection names for typed `db.put('todos', ...)`.

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
- **`sharedWorker` / `dedicatedWorker`** — recommended so bundlers emit worker scripts. See [Install & bundlers](/guide/bundlers). You can omit both — these exports are the defaults.
- Call only in the browser (`window` required; not for SSR).

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

// Query by index (range uses IDBKeyRangeInit shape)
const open = await db.query('todos', {
  index: 'byStatus',
  range: { lower: 'open', upper: 'open' },
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

::: tip Try it
Open the [live demo](/demo/) in two tabs — adds and toggles mirror instantly. Details: [Multi-tab](/guide/multi-tab).
:::

## Remote sync (optional)

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
});

await db.syncNow();
db.onSyncStatusChange((status) => {
  console.log('Pending ops:', status.pending);
});
```

Full contract: [Remote / BYO sync](/guide/sync).

## Cleanup

```typescript
db.close();
```

Call when unmounting a SPA root or logging out. Other tabs keep their connections to the SharedWorker.

## Next steps

- [API overview](/guide/api)
- [React hooks](/guide/react)
- [TypeScript examples](/examples/typescript)
- [Live demo](/demo/)
