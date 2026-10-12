# Быстрый старт

Установите пакет из npm, опишите схему, откройте базу и начинайте читать и писать данные.

## Установка

```bash
npm install worker-sync-db
```

Peer: **TypeScript 5+** (для типов). **React 18+** нужен только если вы используете [`worker-sync-db/react`](/ru/guide/react).

Пакет: [`worker-sync-db` на npm](https://www.npmjs.com/package/worker-sync-db).

## Схема

Схема связывает имена коллекций с object store в IndexedDB:

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

- `keyPath` — поле первичного ключа документа (обычно `'id'`).
- `indexes` — необязательные именованные индексы для `query({ index: 'byStatus', range: ... })`.

`defineSchema` фиксирует литеральные имена коллекций, чтобы вызовы вроде `db.put('todos', ...)` оставались типизированными.

## Открытие базы

```typescript
import { createDatabase, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';
import { schema } from './schema';

const db = await createDatabase({
  schema,
  dbName: 'my-app', // SharedWorker.name + имя базы IndexedDB
  mode: 'auto',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
});
```

- **`dbName`** — стабильное имя между деплоями одного приложения; у разных приложений — разные имена.
- **`sharedWorker` / `dedicatedWorker`** — передавайте явно, чтобы бандлер вынес worker-скрипты в отдельные файлы. См. [Установка и бандлеры](/ru/guide/bundlers). Оба параметра можно опустить — используются эти экспорты по умолчанию.
- Вызывайте только в браузере (нужен `window`; не для SSR).

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

## Подписки (несколько вкладок)

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

Каждая вкладка должна вызвать `subscribe` локально. SharedWorker рассылает события изменений только портам с активной подпиской на эту коллекцию.

::: tip Попробуйте
Откройте [живое демо](https://profyt.github.io/jubilant-journey/) в двух вкладках — добавления и смена статуса отражаются сразу. Подробнее: [Несколько вкладок](/ru/guide/multi-tab).
:::

## Синхронизация с сервером (опционально)

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

Полный контракт: [Свой бэкенд (BYO sync)](/ru/guide/sync).

## Очистка

```typescript
db.close();
```

Вызывайте при размонтировании корня SPA или выходе из аккаунта. Остальные вкладки сохраняют соединения с SharedWorker.

## Дальше

- [Обзор API](/ru/guide/api)
- [React-хуки](/ru/guide/react)
- [Примеры на TypeScript](/ru/examples/typescript)
- [Живое демо](https://profyt.github.io/jubilant-journey/)
