# Несколько вкладок

worker-sync-db синхронизирует все открытые вкладки одного origin через **SharedWorker**, имя которого задаётся `dbName`.

## Как это работает

1. Каждая вкладка вызывает `createDatabase` с одной и той же `schema` и `dbName`.
2. Вкладки подключаются к одному SharedWorker (если браузер его поддерживает).
3. Локальные `put` / `delete` пишут в IndexedDB внутри worker.
4. Worker рассылает события `change` портам, которые вызвали `subscribe` на эту коллекцию.

```typescript
const unsub = db.subscribe('todos', (event) => {
  if (event.type === 'put') {
    // refresh UI with event.doc
  }
});
```

React: [`useQuery`](/ru/guide/react) подписывается за вас; [`useSubscribe`](/ru/guide/react) отдаёт сырой поток.

## Требования

| Requirement | Why |
|-------------|-----|
| Один `dbName` | Scope SharedWorker + имя IndexedDB |
| Одна `schema` | Иначе `SchemaMismatch` |
| Один origin | Изоляция SharedWorker в браузере |
| Активный `subscribe` на вкладке | Fan-out только на подписанные порты |
| `mode: 'auto'` или `'shared'` | Dedicated-режим — только внутри вкладки |

## Поддержка браузеров

- **SharedWorker** — Chromium и Firefox. Нужен для sync между вкладками.
- **Safari / некоторые WebView** — без SharedWorker. При `mode: 'auto'` библиотека падает на dedicated worker (**без sync между вкладками**).

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'auto',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
});
```

## Попробуйте

1. Откройте [живое демо](https://profyt.github.io/jubilant-journey/).
2. Дублируйте вкладку.
3. Добавьте или переключите todo — вторая вкладка обновится сразу.

## Если что-то не работает

Если изменения не появляются в другой вкладке, см. [Устранение проблем](/ru/guide/troubleshooting#изменения-не-появляются-в-другой-вкладке). Архитектура: [Архитектура](/ru/guide/architecture).
