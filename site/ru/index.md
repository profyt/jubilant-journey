---
layout: home
title: Документация
hero:
  name: worker-sync-db
  text: Offline-first IndexedDB для веб-приложений
  tagline: Живые обновления во всех вкладках и синхронизация с вашим API — ядро на TypeScript, React-хуки по желанию.
  actions:
    - theme: brand
      text: Быстрый старт
      link: /ru/guide/getting-started
    - theme: alt
      text: Живое демо
      link: https://profyt.github.io/jubilant-journey/
    - theme: alt
      text: Примеры
      link: /ru/examples/typescript
features:
  - title: Локальное хранилище
    details: Типизированные коллекции в IndexedDB — CRUD, индексы и soft delete. Офлайн работает из коробки.
  - title: Синхронизация вкладок
    details: Один SharedWorker на имя приложения рассылает изменения всем подписанным вкладкам. При необходимости — fallback на DedicatedWorker.
  - title: Свой бэкенд
    details: Опциональные адаптеры push/pull или простые REST URL. Отдельный sync SaaS не нужен.
  - title: React по желанию
    details: Опциональные хуки из worker-sync-db/react — useQuery, useSubscribe, useSyncStatus (peer React 18+).
---

## Быстрые ссылки

<div class="site-cta-row">
  <a class="primary" href="./guide/getting-started">Быстрый старт</a>
  <a href="./guide/api">Обзор API</a>
  <a href="./guide/react">React-хуки</a>
  <a href="./guide/sync">Свой бэкенд (BYO sync)</a>
  <a href="https://profyt.github.io/jubilant-journey/">Открыть демо</a>
  <a href="https://www.npmjs.com/package/worker-sync-db">npm · worker-sync-db</a>
  <a href="https://profyt.github.io/jubilant-journey/llms.txt">llms.txt (для агентов)</a>
</div>

## Установка

```bash
npm install worker-sync-db
```

```typescript
import {
  createDatabase,
  defineSchema,
  sharedWorkerUrl,
  dedicatedWorkerUrl,
} from 'worker-sync-db';

const schema = defineSchema({
  todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
});

const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
});

await db.put('todos', { id: '1', title: 'Buy milk', status: 'open' });
```

Дальше — [быстрый старт](/ru/guide/getting-started) или [живое демо](https://profyt.github.io/jubilant-journey/) в двух вкладках браузера.
