# Архитектура

Карта клиента и worker. Исходники — в каталоге `src/` репозитория.

## Компоненты

| Component | Location | Role |
|-----------|----------|------|
| `createDatabase` | `src/client/createDatabase.ts` | Публичное API, обёртка над `PortBridge` |
| `PortBridge` | `src/client/PortBridge.ts` | RPC + события на `MessagePort` |
| `SharedWorkerBridge` | `src/client/SharedWorkerBridge.ts` | `new SharedWorker()` + connect |
| `MessageRouter` | `src/shared-worker/MessageRouter.ts` | Диспетчеризация запросов |
| `ClientRegistry` | `src/shared-worker/ClientRegistry.ts` | Карта портов, подписки, fan-out |
| `DbEngine` | `src/shared-worker/DbEngine.ts` | CRUD IndexedDB |
| `RemoteSync` | `src/shared-worker/RemoteSync.ts` | Цикл push/pull |

Dedicated worker переиспользует тот же router/engine через внутренний `MessageChannel` (`src/dedicated-worker/entry.ts`).

## Fan-out между вкладками

```
Tab A ──put──► SharedWorker ──IDB write──► response to Tab A
                    │
                    └── change event ──► Tab B (if subscribed)
```

`ClientRegistry` хранит подписки по портам. `broadcastChange` шлёт `{ kind: 'change', collection, type, doc, id }` только клиентам, подписанным на эту коллекцию.

## Раскладка IndexedDB

Для схемы `{ todos: { keyPath: 'id' } }`:

| Store | Purpose |
|-------|---------|
| `todos` | Пользовательские коллекции |
| `_meta` | Ключ-значение курсора sync |
| `sync_queue` | Отложенные записи `PendingOp` |

## Версионирование схемы

`computeSchemaVersion(schema)` хеширует имена коллекций, key path и индексы в целое число — версию IndexedDB. Смена схемы запускает `upgrade` и создаёт новые индексы/store.

Все вкладки с одним `dbName` должны использовать одинаковую JSON-форму схемы, иначе `connect` вернёт `SchemaMismatch`.

## Выбор leader (удалённый sync)

При `connect` с `syncCapable: true` (ставится, если передан адаптер `remote`):

1. Первый способный клиент становится sync leader.
2. `RemoteSync` шлёт `sync:pull` / `sync:push` только на порт leader.
3. Если leader отключается, продвигается следующий клиент с `syncCapable`.

В fetch-режиме HTTP идёт внутри worker; в delegate-режиме HTTP выполняется на leader-вкладке.
