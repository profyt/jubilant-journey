# Удалённый / BYO sync

worker-sync-db работает по модели **offline-first** с опциональной синхронизацией на ваш бэкенд.

1. `put` / `delete` сразу пишут в IndexedDB.
2. Если настроен `remote`, каждая мутация добавляется в `sync_queue` как `PendingOp` (чисто локальные БД очередь не наполняют).
3. `syncNow()` (также планируется после записей) пушит отложенные ops, затем тянет удалённые изменения.
4. Удалённые изменения мержатся по **LWW** (last write wins) через `_updatedAt` и `_version`, затем **рассылаются** подписанным вкладкам как события `change`.

Конфликты решаются last-write-wins по времени — в v1 нет CRDT.

## Delegate vs fetch

### Режим delegate (`RemoteSyncAdapter`)

Когда нужны кастомная авторизация, ретраи или не-REST протоколы. Функции выполняются на **leader-вкладке** (первая подключённая вкладка с `syncCapable: true`). Остальные вкладки получают только broadcast `SyncStatus`.

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
  onConflict: ({ opId, reason }) => {
    console.warn('Conflict', opId, reason);
  },
});
```

### Режим fetch (`FetchSyncConfig`)

Для простых REST-эндпоинтов без кастомной клиентской логики. HTTP выполняется внутри SharedWorker через `fetch()`.

```typescript
remote: {
  pullUrl: '/api/sync/pull',
  pushUrl: '/api/sync/push',
  headers: { Authorization: `Bearer ${token}` },
}
```

## Контракт бэкенда

### Тело push-запроса

```json
{
  "ops": [
    {
      "opId": "uuid",
      "collection": "todos",
      "kind": "put",
      "doc": {
        "id": "1",
        "title": "Milk",
        "status": "open",
        "_version": 2,
        "_updatedAt": 1717000000000
      }
    }
  ]
}
```

### Ответ push

```json
{
  "applied": ["opId-1", "opId-2"],
  "conflicts": [{ "opId": "opId-3", "reason": "version mismatch" }]
}
```

Применённые `opId` удаляются из локальной очереди. Опциональные `conflicts` вызывают `onConflict` на leader-вкладке (режим delegate).

### Ответ pull

```json
{
  "changes": [
    {
      "collection": "todos",
      "kind": "put",
      "doc": {
        "id": "1",
        "title": "Milk",
        "status": "done",
        "_version": 3,
        "_updatedAt": 1717000001000
      }
    }
  ],
  "nextCursor": "cursor-token-or-null"
}
```

`nextCursor` сохраняется в meta IndexedDB и отправляется при следующем pull.

## SyncStatus

```typescript
db.onSyncStatusChange((status) => {
  console.log(status.pending, status.online, status.lastError);
});

await db.syncNow();
```

| Field | Meaning |
|-------|---------|
| `pending` | Ops в очереди sync |
| `lastSyncAt` | Время последней успешной синхронизации |
| `lastError` | Последнее сообщение об ошибке или null |
| `online` | `navigator.onLine` в worker |

## Mock-адаптер

В React-примере используется in-memory адаптер с искусственной задержкой — см. [`examples/vite-react-todos/src/sync/mockAdapter.ts`](https://github.com/profyt/jubilant-journey/blob/main/examples/vite-react-todos/src/sync/mockAdapter.ts) и попробуйте в [живом демо](https://profyt.github.io/jubilant-journey/).
