# React hooks

Optional peer: **React 18+**. The core package works without React.

```bash
npm install worker-sync-db react
```

```typescript
import { createDatabase } from 'worker-sync-db';
import {
  DatabaseProvider,
  useQuery,
  useSubscribe,
  useSyncStatus,
  useDatabase,
} from 'worker-sync-db/react';
```

Import from **`worker-sync-db/react`** — not the package root.

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

Initialize only on the client (`useEffect`) — `createDatabase` needs `window`.

## `useQuery`

Live list: runs `db.query` and refreshes on collection `subscribe` events.

```tsx
// explicit db
const { data, loading, error, refetch } = useQuery(db, 'todos', {
  index: 'byStatus',
  range: { lower: 'open', upper: 'open' },
});

// via provider
const { data } = useQuery('todos');
```

Options extend `QueryOptions` with `enabled?: boolean`.

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
// { pending, lastSyncAt, lastError, online }
```

## `useDatabase`

Returns the client from context (`null` while opening).

## Full example

See [React examples](/examples/react) and the [live demo](/demo/) source under `examples/vite-react-todos`.
