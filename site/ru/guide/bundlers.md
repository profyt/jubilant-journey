# Установка и бандлеры

У `worker-sync-db` четыре точки входа. Бандлер должен вынести worker-скрипты в **отдельные файлы**.

| Export | Назначение |
|--------|------------|
| `worker-sync-db` | Клиентское ядро (`createDatabase`, хелперы схемы) |
| `worker-sync-db/react` | Опциональные React-хуки |
| `worker-sync-db/shared-worker` | Entry SharedWorker |
| `worker-sync-db/dedicated-worker` | Fallback DedicatedWorker |

## Установка

```bash
npm install worker-sync-db
```

```typescript
import {
  createDatabase,
  sharedWorkerUrl,
  dedicatedWorkerUrl,
} from 'worker-sync-db';

const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
  mode: 'auto',
});
```

`sharedWorkerUrl` и `dedicatedWorkerUrl` — объекты `URL`, собранные через `new URL('./shared-worker/entry.js', import.meta.url)` **внутри пакета**. Бандлеры (Vite, Webpack 5) распознают этот паттерн в `node_modules` и эмитят worker-чанки.

Бандлы worker **инлайнят `idb`**, поэтому они самодостаточны.

Оба параметра можно опустить — `createDatabase` берёт эти экспорты по умолчанию.

::: warning Не используйте bare package paths в `new URL`
Не пишите `new URL('worker-sync-db/shared-worker', import.meta.url)` в коде приложения — алиасы там не применяются и часто приводят к `Port closed`. Предпочитайте `sharedWorkerUrl` / `dedicatedWorkerUrl`.
:::

## Vite — явный импорт `?url`

```typescript
import sharedWorkerUrl from 'worker-sync-db/dist/shared-worker/entry.js?url';
```

Полезно, если тулчейн не прослеживает `new URL` в зависимостях.

## Локальный монорепозиторий / зависимость `file:`

При линковке библиотеки из этого репозитория:

```json
"worker-sync-db": "file:../.."
```

Сначала соберите библиотеку (`npm run build` в корне репозитория), затем укажите URL на `dist` или resolve-алиасы, как в [examples/vite-react-todos](https://github.com/profyt/jubilant-journey/tree/main/examples/vite-react-todos).

## Webpack 5

Используйте `new URL(..., import.meta.url)` с включённым `module.parser.javascript.importMeta` (по умолчанию в Webpack 5).

```typescript
sharedWorker: new URL(
  'worker-sync-db/dist/shared-worker/entry.js',
  import.meta.url,
),
```

## Только dedicated worker

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'dedicated',
  dedicatedWorker: dedicatedWorkerUrl,
});
```

В dedicated-режиме **нет синхронизации между вкладками**. По возможности предпочитайте `mode: 'auto'`.

## Чеклист

- [ ] Передан URL `sharedWorker` (или используется экспорт по умолчанию)
- [ ] Передан URL `dedicatedWorker` при `mode: 'auto'`
- [ ] Библиотека собрана перед потреблением через `file:`
- [ ] Одинаковые `dbName` и `schema` во всех вкладках
