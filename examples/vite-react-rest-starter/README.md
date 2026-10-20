# worker-sync-db — Vite + React REST starter

Minimal **Vite + React + TypeScript** app that wires `worker-sync-db` to a **fetch sync** backend with **auth headers**.

## Run

From the library repo root:

```bash
npm run build
npm run example:starter:install
npm run example:starter:dev
```

Open http://localhost:5174 — add a note, then open a second tab. The Vite middleware at `/api/sync/*` accepts:

```http
Authorization: Bearer demo-token
```

(Token constant: `src/sync/auth.ts`.)

## What to copy

| File | Role |
|------|------|
| `src/db/client.ts` | `createDatabase` + `remote: { pullUrl, pushUrl, headers }` |
| `src/db/workers.ts` | Vite SharedWorker / dedicated worker URLs |
| `src/sync/auth.ts` | Bearer token used in headers |
| `mockSyncMiddleware.ts` | Demo REST contract (replace with your API) |
| `src/App.tsx` | React hooks (`useQuery`, `useSyncStatus`) |

Replace `AUTH_TOKEN` / `headers` with your real auth. Sync contract: [docs/sync.md](../../docs/sync.md).

## Not included

Full todos demo / marketing benches — see [`../vite-react-todos`](../vite-react-todos).
