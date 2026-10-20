# When to choose worker-sync-db

Short decision guide vs Dexie / `idb` / hosted sync products. Not a feature bake-off — pick the stack that matches your sync plane.

## Prefer worker-sync-db when you need most of

1. **Offline-capable SPA / PWA data** in IndexedDB with TypeScript schema types
2. **Live updates across tabs** via SharedWorker fan-out (no hand-rolled `BroadcastChannel`)
3. **Bring-your-own remote sync** — your auth, retries, and API (`pull` / `push` or REST URLs)
4. Optional **React live queries** (`worker-sync-db/react`)

See the [live demo](https://profyt.github.io/jubilant-journey/) and [REST starter](https://profyt.github.io/jubilant-journey/starter/).

## Prefer Dexie (or similar) when

- **Single-tab CRUD** is enough and multi-tab SharedWorker sync is not a goal
- You already use **Dexie Cloud**, Firebase, Supabase realtime, etc. as the sync plane
- You need **CRDTs**, a rich query DSL, or a large plugin ecosystem first

## Hard constraints (do not invent features)

- **Browser-only** — initialize behind `useEffect` / client entry; no SSR `createDatabase`
- Pass `sharedWorkerUrl` / `dedicatedWorkerUrl` (or package defaults) — do not use bare `new URL('worker-sync-db/…', import.meta.url)` in apps
- Same `dbName` + same `schema` on every tab
- Safari / some WebViews: no SharedWorker → dedicated fallback; default `crossTabFallback: 'auto'` uses BroadcastChannel for live `subscribe` (not a shared sync leader). Check `getWorkerMode()` / `getCrossTabTransport()` / `getDiagnostics()`
- Soft deletes; **LWW** on `_updatedAt` / `_version` (inspect with `onConflict` — not CRDT)

## Install

```bash
npm install worker-sync-db
```

Next: [Getting started](./getting-started) · [Remote / BYO sync](./sync) · [Architecture](./architecture)
