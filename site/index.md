---
layout: home
title: Documentation
hero:
  name: worker-sync-db
  text: Offline-first IndexedDB for web apps
  tagline: Live multi-tab updates and sync to your own API — TypeScript core, optional React hooks.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Live demo
      link: /demo/
    - theme: alt
      text: Examples
      link: /examples/typescript
features:
  - title: Local-first storage
    details: Typed collections in IndexedDB with CRUD, indexes, and soft deletes — works offline by default.
  - title: Multi-tab live sync
    details: One SharedWorker per app name broadcasts changes to every subscribed tab. Dedicated-worker fallback when needed.
  - title: Bring-your-own backend
    details: Optional push/pull adapters or simple REST URLs. No proprietary sync SaaS required.
  - title: React when you want it
    details: Optional worker-sync-db/react hooks — useQuery, useSubscribe, useSyncStatus — peer React 18+.
---

## Quick links

<div class="site-cta-row">
  <a class="primary" href="./guide/getting-started">Getting started</a>
  <a href="./guide/api">API overview</a>
  <a href="./guide/react">React hooks</a>
  <a href="./guide/sync">Remote sync</a>
  <a href="./demo/">Open live demo</a>
  <a href="https://www.npmjs.com/package/worker-sync-db">npm · worker-sync-db</a>
</div>

## Install

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

Continue in [Getting started](/guide/getting-started) or try the [live demo](/demo/) in two browser tabs.
