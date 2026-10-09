# React examples

Copy-paste patterns using `worker-sync-db/react`. Peer: React 18+.

## Provider setup

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import {
  createDatabase,
  defineSchema,
  sharedWorkerUrl,
  dedicatedWorkerUrl,
  type DatabaseClient,
} from 'worker-sync-db';
import { DatabaseProvider } from 'worker-sync-db/react';

const schema = defineSchema({
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
});

export function AppDatabase({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DatabaseClient<typeof schema> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let client: DatabaseClient<typeof schema> | undefined;
    let cancelled = false;

    void createDatabase({
      schema,
      dbName: 'react-todos',
      sharedWorker: sharedWorkerUrl,
      dedicatedWorker: dedicatedWorkerUrl,
    })
      .then((opened) => {
        if (cancelled) {
          opened.close();
          return;
        }
        client = opened;
        setDb(opened);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      client?.close();
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!db) return <p>Opening local database…</p>;

  return <DatabaseProvider db={db}>{children}</DatabaseProvider>;
}
```

## Live list with `useQuery`

```tsx
import { useState } from 'react';
import { useQuery, useDatabase } from 'worker-sync-db/react';

export function TodoList() {
  const db = useDatabase();
  const [title, setTitle] = useState('');
  const { data: todos = [], loading, error } = useQuery('todos');

  if (!db) return null;
  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">{String(error)}</p>;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = title.trim();
          if (!value) return;
          void db.put('todos', {
            id: crypto.randomUUID(),
            title: value,
            status: 'open',
          });
          setTitle('');
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New todo"
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.status === 'done'}
                onChange={() =>
                  void db.put('todos', {
                    ...todo,
                    status: todo.status === 'done' ? 'open' : 'done',
                  })
                }
              />
              {todo.title}
            </label>
            <button type="button" onClick={() => void db.delete('todos', todo.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Filtered query + sync status

```tsx
import { useQuery, useSyncStatus } from 'worker-sync-db/react';

export function OpenTodos() {
  const sync = useSyncStatus();
  const { data: open = [] } = useQuery('todos', {
    index: 'byStatus',
    range: { lower: 'open', upper: 'open' },
  });

  return (
    <section>
      <p>
        Pending sync: {sync?.pending ?? 0}
        {sync?.lastError ? ` · ${sync.lastError}` : ''}
      </p>
      <ul>
        {open.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    </section>
  );
}
```

## `useSubscribe` for side effects

```tsx
import { useSubscribe } from 'worker-sync-db/react';

export function TodoToaster() {
  useSubscribe('todos', (event) => {
    if (event.type === 'put') {
      console.log('todo changed', event.id);
    }
  });
  return null;
}
```

## Full demo app

The published Pages demo is a complete todos UI with mock remote sync:

- [Open live demo](https://profyt.github.io/jubilant-journey/)
- Source: [`examples/vite-react-todos`](https://github.com/profyt/jubilant-journey/tree/main/examples/vite-react-todos)

Run locally from the repo root:

```bash
npm install
npm run build
npm run example:dev
```
