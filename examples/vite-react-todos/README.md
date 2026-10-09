# vite-react-todos

Live demo for [worker-sync-db](../../README.md): SharedWorker todos, React hooks (`useQuery` / `useSyncStatus`), mock remote sync, multi-tab fan-out.

## Prerequisites

```bash
cd ../..
npm install
npm run build
```

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in **two tabs**.

## GitHub Pages

CI workflow [pages.yml](../../.github/workflows/pages.yml) deploys this app to:

https://profyt.github.io/jubilant-journey/

Enable once: repo **Settings → Pages → Source: GitHub Actions**.

## Code map

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | `defineSchema` + todo types |
| `src/db/DatabaseProvider.tsx` | `createDatabase` + package `DatabaseProvider` |
| `src/db/useTodos.ts` | App logic on top of `useQuery` |
| `src/db/workers.ts` | Vite `?sharedworker&url` / `?worker&url` (deps bundled) |
| `src/sync/mockAdapter.ts` | In-memory `RemoteSyncAdapter` |
| `src/App.tsx` / `App.css` | Brand-first demo UI |
