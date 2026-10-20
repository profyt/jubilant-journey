# Устранение проблем

## `SchemaMismatch`

**Причина:** вкладка подключилась со `schema`, отличной от той, с которой первый клиент открыл `dbName`.

**Что сделать:**

- Выкатывайте смену схемы атомарно (все пользователи перезагружают страницу).
- Для ломающих изменений схемы используйте новый `dbName`.
- В разработке очищайте IndexedDB в DevTools.

## Изменения не появляются в другой вкладке

**Чеклист:**

1. Используется `mode: 'shared'` или `'auto'` (не `dedicated`).
2. Вторая вкладка вызвала `db.subscribe('collection', listener)`.
3. Один и тот же `dbName` и origin.
4. SharedWorker ещё работает (DevTools → Application → Shared workers).

## `SharedWorker is not supported`

Некоторые WebView и старые браузеры не поддерживают SharedWorker.

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'auto', // falls back to dedicated
  dedicatedWorker: dedicatedWorkerUrl,
});
```

Dedicated-режим: **без синхронизации между вкладками**.

## `Port closed` или worker не загрузился

**Причина:** скрипт SharedWorker вернул 404 или не распарсился. Часто из‑за:

```typescript
// Wrong in Vite apps — alias is not applied to new URL(...)
new URL('worker-sync-db/shared-worker', import.meta.url)
```

**Исправление:**

```typescript
import { createDatabase, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';

await createDatabase({
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
  // ...
});
// or omit both — they are the defaults
```

- Соберите библиотеку: `npm run build` в корне пакета (нужно для линка `file:../..`).
- См. [Установка и бандлеры](/ru/guide/bundlers).

## `createDatabase requires a browser environment`

Вызов во время SSR или в Node-тестах без `window`. Инициализируйте только в `useEffect` / клиентском entry.

## Sync не завершается / `pending` остаётся высоким

1. Проверьте `status.lastError` через `getSyncStatus()`.
2. Убедитесь, что leader-вкладка открыта (режим delegate).
3. Подтвердите, что push возвращает `applied` opId, совпадающие с очередью.
4. Сеть офлайн: `status.online === false` до события `online`.

## IndexedDB `QuotaExceededError`

Часто в приватном режиме Safari или при заполненном диске. Ловите ошибки хранилища и предупреждайте пользователей; уменьшайте объём данных.

## Диагностика

1. Проверьте `await db.getDiagnostics()` (режим worker, транспорт, `queueDepth`, `lastError`) или `getSyncStatus()`.
2. Для push-конфликтов: `getPendingOps()` (смотрите `failedReason`), затем `discardFailedOps()` и `syncNow()`.

## DevTools

| Инструмент | Где смотреть |
|------------|--------------|
| Консоль SharedWorker | Application → Shared workers → ваш `dbName` |
| IndexedDB | Application → IndexedDB → `dbName` |
| Отложенные sync ops | object store `sync_queue` |

## Таймауты (`DbError: Timeout`)

Таймаут RPC по умолчанию — 30 секунд. Большие pull-пейлоады или заблокированный main thread на leader-вкладке могут задерживать ответы delegate. Держите `pull`/`push` адаптера быстрыми.
