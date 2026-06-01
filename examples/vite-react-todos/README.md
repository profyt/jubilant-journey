# vite-react-todos

React demo for [worker-sync-db](../../README.md): typed todos with SharedWorker, live subscriptions across tabs, and mock remote sync.

## Prerequisites

Build the library from the repository root:

```bash
cd ../..
npm install
npm run build
```

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 in **two tabs** to see multi-tab sync.

## What to try

1. Add todos — stored in IndexedDB inside the SharedWorker.
2. Toggle / delete — other tab updates if it is on the same page.
3. **Sync now** — pushes pending ops to the in-memory mock server and pulls changes (300ms simulated latency).
4. DevTools → Application → **Shared workers** → `vite-react-todos` → console logs.
5. DevTools → **IndexedDB** → `vite-react-todos` → `todos` store.

## Code map

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | `CollectionSchema` + `Todo` type |
| `src/db/DatabaseProvider.tsx` | `createDatabase` + React context |
| `src/db/useTodos.ts` | `query`, `subscribe`, CRUD hooks |
| `src/sync/mockAdapter.ts` | `RemoteSyncAdapter` without a real backend |

## Worker URLs

Worker URLs are imported from the package (see `src/db/DatabaseProvider.tsx`):

```typescript
import { sharedWorkerUrl, dedicatedWorkerUrl, createDatabase } from 'worker-sync-db';
```

`npm run dev` runs `predev` and builds the library in the repo root first. If you see **Port closed** or **SharedWorker failed to load**, run `npm run build` in the repository root.

See [docs/bundlers.md](../../docs/bundlers.md) for production setups.
