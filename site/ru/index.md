---
layout: home
title: Документация
hero:
  name: worker-sync-db
  text: Offline-first IndexedDB для веб-приложений
  tagline: Живые обновления между вкладками и sync с вашим API — ядро на TypeScript, опциональные React-хуки.
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
    details: Типизированные коллекции в IndexedDB с CRUD, индексами и soft delete — по умолчанию работает офлайн.
  - title: Синхронизация вкладок
    details: Один SharedWorker на имя приложения рассылает изменения всем подписанным вкладкам. При необходимости — fallback на DedicatedWorker.
  - title: Свой бэкенд
    details: Опциональные адаптеры push/pull или простые REST URL. Отдельный sync SaaS не нужен.
  - title: React по желанию
    details: Опциональные хуки worker-sync-db/react — useQuery, useSubscribe, useSyncStatus — peer React 18+.
---

## Быстрые ссылки

<div class="site-cta-row">
  <a class="primary" href="./guide/getting-started">Быстрый старт</a>
  <a href="./guide/api">Обзор API</a>
  <a href="./guide/react">React-хуки</a>
  <a href="./guide/sync">Удалённый sync</a>
  <a href="https://profyt.github.io/jubilant-journey/">Открыть демо</a>
  <a href="https://www.npmjs.com/package/worker-sync-db">npm · worker-sync-db</a>
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

Продолжайте в разделе [Быстрый старт](/ru/guide/getting-started) или откройте [живое демо](https://profyt.github.io/jubilant-journey/) в двух вкладках браузера.
