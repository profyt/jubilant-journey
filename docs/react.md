# React hooks (`worker-sync-db/react`)

Optional peer: **React 18+**. The core package works without React.

```bash
npm install worker-sync-db react
```

```typescript
import { createDatabase } from 'worker-sync-db';
import {
  DatabaseProvider,
  useQuery,
  useLiveQuery,
  useSubscribe,
  useSyncStatus,
  useDatabase,
} from 'worker-sync-db/react';
```

## `DatabaseProvider`

Holds a `DatabaseClient` so hooks can omit the `db` argument.

```tsx
const [db, setDb] = useState<DatabaseClient<typeof schema> | null>(null);

useEffect(() => {
  let client: Awaited<ReturnType<typeof createDatabase>> | undefined;
  void createDatabase({ schema, dbName: 'app' }).then((opened) => {
    client = opened;
    setDb(opened);
  });
  return () => client?.close();
}, []);

return <DatabaseProvider db={db}>{children}</DatabaseProvider>;
```

## `useQuery` / `useLiveQuery`

Live list: runs `db.query` and refreshes on collection `subscribe` events.
`useLiveQuery` is the same function (Dexie-style alias).

```tsx
// explicit db
const { data, loading, error, refetch } = useQuery(db, 'todos', {
  index: 'byStatus',
  range: { lower: 'open', upper: 'open' },
});

// via provider — client-side filter/sort after IDB
const { data } = useLiveQuery('todos', {
  filter: (d) => d.status === 'open',
  orderBy: { field: 'title', direction: 'asc' },
  limit: 20,
});
```

Options extend `QueryOptions` with `enabled?: boolean`.

| Option | Where | Notes |
|--------|-------|-------|
| `index` / `range` | IndexedDB | Uses schema indexes |
| `includeDeleted` | IndexedDB | Soft-deleted rows |
| `filter` / `orderBy` | Client | After IDB; not sent to the worker |
| `limit` | IDB, or after filter/sort | When `filter`/`orderBy` set, limit applies **after** them |

## `useSubscribe`

Raw change stream (listener kept in a ref — inline functions are fine).

```tsx
useSubscribe(db, 'todos', (event) => {
  console.log(event.type, event.id);
});

useSubscribe('todos', (event) => console.log(event), {
  field: 'status',
  value: 'open',
});
```

## `useSyncStatus`

```tsx
const status = useSyncStatus(); // or useSyncStatus(db)
// { pending, lastSyncAt, lastError, online, nextSyncAt, paused? }
```

## `useDatabase`

Returns the client from context (`null` while opening).
