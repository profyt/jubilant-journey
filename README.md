# worker-sync-db

> **Suggested GitHub description:** Offline-first local database for web apps — one IndexedDB per site, live updates across tabs, sync to your own API.

**worker-sync-db** helps you build **offline-first SPAs** without a proprietary sync SaaS: data lives in the browser, updates instantly in the UI, stays consistent when the user opens several tabs, and syncs to **your backend** when you wire up push/pull.

**[Live demo](https://profyt.github.io/jubilant-journey/)** · [Documentation](#documentation)

## Who it's for

- Teams shipping a **web app** (React or vanilla) that must work **offline** and catch up when online
- Apps where **multiple tabs** should show the same data without custom `BroadcastChannel` glue
- Developers who want **IndexedDB + TypeScript** and a **bring-your-own-server** sync contract — not Dexie Cloud / Firebase lock-in

## What you get

| Capability | In plain terms |
|------------|----------------|
| Local storage | Typed collections in **IndexedDB**, CRUD + queries |
| Multi-tab | One shared background worker per app name — changes appear in every open tab |
| Live UI | `subscribe` (or React `useQuery`) refreshes when data changes locally or after sync |
| Sync | Optional queue: your `push` / `pull` (or simple REST URLs) when the network is back |
| React (optional) | `worker-sync-db/react` — `useQuery`, `useSubscribe`, `useSyncStatus` |

Under the hood the library uses a **SharedWorker** when the browser supports it; otherwise it falls back to a per-tab worker (multi-tab sync is then limited). Details: [architecture](docs/architecture.md).

## Install

```bash
npm install worker-sync-db
```

Peer: **TypeScript 5+** (for types). **React 18+** only if you import `worker-sync-db/react`.

## Quick start

```typescript
import { createDatabase, defineSchema, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';

const schema = defineSchema({
  todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
});

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

await db.put('todos', { id: '1', title: 'Buy milk', status: 'open' });

db.subscribe('todos', (e) => {
  if (e.type === 'put') console.log(e.doc);
});
```

Bundlers must emit worker scripts — pass `sharedWorkerUrl` / `dedicatedWorkerUrl` (or see [bundlers.md](docs/bundlers.md)).

### React

```typescript
import { DatabaseProvider, useQuery, useSyncStatus } from 'worker-sync-db/react';

const { data, loading } = useQuery(db, 'todos');
const sync = useSyncStatus(db);
```

Guide: [docs/react.md](docs/react.md).

## Sync (your API)

Offline-first: **writes always land locally first**; if you pass `remote`, changes are queued and sent with `syncNow()` (also after mutations).

- **Custom logic** — object with `pull(cursor)` and `push(ops)` (auth, retries, any protocol)
- **Simple REST** — `pullUrl`, `pushUrl`, optional `headers`

Backend shape and conflict behavior: [docs/sync.md](docs/sync.md). Conflicts use last-write-wins on timestamps (no CRDT in v1).

## Try the demo locally

```bash
npm install
npm run build
npm run example:dev
```

Open http://localhost:5173 in two tabs to see cross-tab updates. Source: [examples/vite-react-todos](examples/vite-react-todos).

## Browser & environment

- **Browser only** — `createDatabase` needs `window` (not for SSR)
- **SharedWorker** — required for multi-tab sync; supported in Chromium and Firefox (not Safari). Use `mode: 'auto'` (default) for fallback
- **Same schema** — all tabs must use the same `schema` and `dbName` for one app

## Documentation

| Guide | Topics |
|-------|--------|
| [getting-started.md](docs/getting-started.md) | Schema, first app |
| [api.md](docs/api.md) | Full API |
| [react.md](docs/react.md) | Hooks |
| [sync.md](docs/sync.md) | Push/pull contract |
| [bundlers.md](docs/bundlers.md) | Vite / Webpack |
| [troubleshooting.md](docs/troubleshooting.md) | Common errors |
| [architecture.md](docs/architecture.md) | Internals (optional) |
| [publishing.md](docs/publishing.md) | npm publish (maintainers) |

## License

MIT
