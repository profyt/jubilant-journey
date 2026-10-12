# React-хуки

Опциональный peer: **React 18+**. Ядро пакета работает без React.

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

Импортируйте из **`worker-sync-db/react`**, а не из корня пакета.

## `DatabaseProvider`

Хранит `DatabaseClient`, чтобы хуки могли не передавать аргумент `db`.

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

Инициализируйте только на клиенте (`useEffect`) — `createDatabase` нужен `window`.

## `useQuery`

Живой список: вызывает `db.query` и обновляется по событиям `subscribe` коллекции.

```tsx
// explicit db
const { data, loading, error, refetch } = useQuery(db, 'todos', {
  index: 'byStatus',
  range: { lower: 'open', upper: 'open' },
});

// via provider
const { data } = useQuery('todos');
```

Опции расширяют `QueryOptions` полем `enabled?: boolean`.

## `useSubscribe`

Сырой поток изменений (listener хранится в ref — inline-функции допустимы).

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

Возвращает клиент из контекста (`null`, пока база открывается).

## Полный пример

См. [Примеры на React](/ru/examples/react) и исходники [живого демо](https://profyt.github.io/jubilant-journey/) в `examples/vite-react-todos`.
