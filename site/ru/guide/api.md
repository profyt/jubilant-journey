# Обзор API

Публичный API пакета `worker-sync-db`. Типы выводятся из схемы через `defineSchema`.

## `createDatabase(options)`

```typescript
function createDatabase<S extends CollectionSchema>(
  options: CreateDatabaseOptions<S>,
): Promise<DatabaseClient<S>>;
```

### `CreateDatabaseOptions`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `schema` | `S extends CollectionSchema` | да | Определения коллекций |
| `dbName` | `string` | да | Имя SharedWorker + имя IndexedDB |
| `sharedWorker` | `string \| URL` | рекомендуется | URL бандла shared-worker |
| `dedicatedWorker` | `string \| URL` | рекомендуется | URL бандла dedicated-worker |
| `mode` | `'auto' \| 'shared' \| 'dedicated'` | нет | По умолчанию `'auto'` |
| `remote` | `RemoteSyncAdapter \| FetchSyncConfig` | нет | Включает синхронизацию |
| `onConflict` | `(conflict) => void` | нет | Конфликты push (delegate-адаптер) |

Бросает ошибку, если `window` не определён (SSR).

### Экспорты URL worker

```typescript
import { sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';
```

Объекты `URL` на `dist/shared-worker/entry.js` и `dist/dedicated-worker/entry.js`. Используются по умолчанию, если `sharedWorker` / `dedicatedWorker` не указаны.

## `DatabaseClient<S>`

### `get(collection, id)`

```typescript
get<C extends keyof S & string>(
  collection: C,
  id: string,
): Promise<InferDoc<S, C> | null>;
```

Возвращает документ или `null`, если его нет или он помечен soft-deleted.

### `put(collection, doc)`

```typescript
put<C extends keyof S & string>(
  collection: C,
  doc: Record<string, unknown> & { id: string },
): Promise<InferDoc<S, C>>;
```

Upsert документа. Добавляет `_version`, `_updatedAt`. Ставит операцию синхронизации в очередь, если задан `remote`. Уведомляет все подписанные вкладки.

### `delete(collection, id)`

```typescript
delete<C extends keyof S & string>(
  collection: C,
  id: string,
): Promise<InferDoc<S, C>>;
```

Soft-delete (`_deleted: true`). Возвращает обновлённый документ или бросает `NotFound`.

### `batch(ops)`

```typescript
batch(ops: BatchOp[]): Promise<BatchResultItem[]>;
```

Несколько `put`/`delete` по разным коллекциям в **одной транзакции IndexedDB**. Отсутствующие id при delete пропускаются. Сторы должны уже быть в схеме (открываются заранее). Soft-delete и last-write-wins — не CRDT. Для массовой записи в одну коллекцию лучше `putMany` / `deleteMany`.

### `query(collection, opts?)`

```typescript
query<C extends keyof S & string>(
  collection: C,
  opts?: QueryOptions,
): Promise<InferDoc<S, C>[]>;
```

| `QueryOptions` | Описание |
|----------------|----------|
| `index` | Имя индекса из схемы |
| `range` | `IDBKeyRangeInit`: обе границы → `only`/`bound`; только `lower` → `lowerBound`; только `upper` → `upperBound` |
| `limit` | Максимум результатов |
| `includeDeleted` | Включать soft-deleted документы |

### `subscribe(collection, listener, filter?)`

```typescript
subscribe<C extends keyof S & string>(
  collection: C,
  listener: (event: ChangeEvent<InferDoc<S, C>>) => void,
  filter?: { field: string; value: unknown },
): () => void;
```

`ChangeEvent`:

```typescript
{
  type: 'put' | 'delete';
  collection: string;
  doc: T | null;  // null on delete
  id: string;
}
```

Возвращает функцию отписки. Регистрируйте в каждой вкладке, которая должна получать live-обновления.

Опциональный `filter` ограничивает fan-out worker для put, где `doc[field] === value` (при фильтре события delete не доставляются). Фильтр берётся у **первого** подписчика коллекции во вкладке.

Также получает изменения, применённые из удалённого `pull` (не только локальные записи между вкладками).

### `syncNow()`

```typescript
syncNow(): Promise<SyncStatus>;
```

Отправляет отложенные операции (`push`), затем забирает удалённые изменения (`pull`). Если `remote` не настроен, очередь не отправляется.

### `getSyncStatus()` / `onSyncStatusChange(listener)`

```typescript
interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  online: boolean;
}
```

### `close()`

Отправляет `disconnect`, закрывает порт, отклоняет незавершённые RPC.

## Типы

### `defineSchema` / `CollectionSchema`

```typescript
type CollectionSchema = Record<
  string,
  { keyPath: string; indexes?: Record<string, string> }
>;

function defineSchema<S extends CollectionSchema>(schema: S): S;
```

### `DocumentMeta`

```typescript
interface DocumentMeta {
  id: string;
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
}
```

### Sync-адаптеры

```typescript
interface RemoteSyncAdapter {
  pull(cursor: string | null): Promise<{
    changes: RemoteChange[];
    nextCursor: string | null;
  }>;
  push(ops: PendingOp[]): Promise<{
    applied: string[];
    conflicts?: Conflict[];
  }>;
}

interface FetchSyncConfig {
  pullUrl: string;
  pushUrl: string;
  headers?: Record<string, string>;
}
```

## Ошибки

`DatabaseError` с полем `code`:

| Код | Значение |
|-----|----------|
| `NotFound` | Документ не найден при delete |
| `WorkerDead` | SharedWorker / Worker не загрузился |
| `SchemaMismatch` | Другая схема для того же `dbName` |
| `NotConnected` | Порт закрыт |
| `Timeout` | RPC превысил таймаут (по умолчанию 30 с) |
| `InvalidRequest` | Неизвестный запрос или abort |
| `StorageError` | Сбой IndexedDB / sync |

## Низкоуровневое API

Для продвинутой интеграции без `createDatabase`:

- `connectSharedWorker(options)` → `PortBridge`
- `connectDedicatedWorker(options)` → `PortBridge`
- `PortBridge.call(request)` — типизированный RPC
- `PortBridge.onEvent(listener)` — события worker

См. `src/client/PortBridge.ts` и `src/shared/protocol.ts` в репозитории.
