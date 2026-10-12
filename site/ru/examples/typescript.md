# Примеры на TypeScript

Готовые фрагменты для vanilla-приложения (без React). API совпадает с опубликованным пакетом `worker-sync-db`.

## Схема + открытие

```typescript
import {
  createDatabase,
  defineSchema,
  sharedWorkerUrl,
  dedicatedWorkerUrl,
} from 'worker-sync-db';

const schema = defineSchema({
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
});

export type AppSchema = typeof schema;

export async function openAppDb() {
  return createDatabase({
    schema,
    dbName: 'my-app',
    mode: 'auto',
    sharedWorker: sharedWorkerUrl,
    dedicatedWorker: dedicatedWorkerUrl,
  });
}
```

## CRUD-хелперы

```typescript
import type { DatabaseClient } from 'worker-sync-db';
import type { AppSchema } from './db';

type Todo = {
  id: string;
  title: string;
  status: 'open' | 'done';
};

export async function addTodo(
  db: DatabaseClient<AppSchema>,
  title: string,
) {
  return db.put('todos', {
    id: crypto.randomUUID(),
    title,
    status: 'open',
  } satisfies Todo);
}

export async function listOpen(db: DatabaseClient<AppSchema>) {
  return db.query('todos', {
    index: 'byStatus',
    range: { lower: 'open', upper: 'open' },
  });
}

export async function completeTodo(
  db: DatabaseClient<AppSchema>,
  id: string,
) {
  const existing = await db.get('todos', id);
  if (!existing) return null;
  return db.put('todos', { ...existing, status: 'done' });
}
```

## Живой UI с `subscribe`

```typescript
const db = await openAppDb();
const listEl = document.querySelector('#todos')!;

async function render() {
  const todos = await db.query('todos');
  listEl.innerHTML = todos
    .map((t) => `<li data-id="${t.id}">${t.title} — ${t.status}</li>`)
    .join('');
}

await render();

const unsub = db.subscribe('todos', () => {
  void render();
});

// cleanup on unload
window.addEventListener('pagehide', () => {
  unsub();
  db.close();
});
```

Откройте два окна приложения — оба обработчика сработают, когда любая вкладка пишет данные.

## Опциональная синхронизация с сервером

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
  remote: {
    pullUrl: '/api/sync/pull',
    pushUrl: '/api/sync/push',
    headers: { Authorization: `Bearer ${token}` },
  },
});

db.onSyncStatusChange((s) => {
  console.log('pending', s.pending, 'online', s.online);
});

await db.syncNow();
```

Подробнее про адаптеры: [Свой бэкенд (BYO sync)](/ru/guide/sync).

## См. также

- [Примеры на React](/ru/examples/react)
- [Живое демо](https://profyt.github.io/jubilant-journey/)
- [Обзор API](/ru/guide/api)
