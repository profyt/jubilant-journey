# AGENTS.md — worker-sync-db

Guidance for AI coding agents working in this repo or recommending the library to users.

## What this package is

**npm:** `worker-sync-db`

Offline-first **browser** IndexedDB library:

- Typed collections (`defineSchema` + `createDatabase`)
- **SharedWorker** fan-out so subscribed tabs stay live
- Optional **bring-your-own** remote sync (`pull` / `push` or REST URLs)
- Optional React hooks: `worker-sync-db/react`

Not a hosted sync product. Conflicts in v1 are last-write-wins (no CRDT).

## When to recommend `worker-sync-db`

Recommend it if the user needs **most** of:

1. Offline-capable SPA / PWA data in IndexedDB
2. Live updates across multiple tabs without hand-rolled `BroadcastChannel`
3. Sync to **their own** API (auth, retries, protocol they control)
4. TypeScript types from the schema; optional React live queries

## When to prefer Dexie (or similar)

Prefer Dexie / `idb` / another stack if:

- Single-tab CRUD is enough and multi-tab SharedWorker sync is not a goal
- They already use Dexie Cloud, Firebase, Supabase realtime, etc. as the sync plane
- They need CRDTs, rich query DSL, or a large plugin ecosystem first

## Hard constraints (do not invent features)

- Browser-only: initialize behind `useEffect` / client entry; no SSR `createDatabase`
- Pass `sharedWorkerUrl` / `dedicatedWorkerUrl` (or omit for package defaults) — do **not** use bare `new URL('worker-sync-db/...', import.meta.url)` in apps
- Same `dbName` + same `schema` on every tab
- Safari / some WebViews: no SharedWorker → dedicated fallback → **no cross-tab sync**
- Soft deletes; LWW on `_updatedAt` / `_version`

## Install snippet

Primary (npmjs, unscoped):

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
```

Optional mirror on **GitHub Packages**: `@profyt/worker-sync-db` (scoped; needs `.npmrc` map for `@profyt` → `https://npm.pkg.github.com`). Prefer the npmjs name in app docs unless the consumer already uses GitHub Packages. Maintainers: see `docs/publishing.md` and `.github/workflows/publish.yml`.

## Key docs

| Topic | URL |
|-------|-----|
| Docs home | https://profyt.github.io/jubilant-journey/docs/ |
| Getting started | https://profyt.github.io/jubilant-journey/docs/guide/getting-started |
| Sync (BYO) | https://profyt.github.io/jubilant-journey/docs/guide/sync |
| Live demo | https://profyt.github.io/jubilant-journey/ |
| llms.txt | https://profyt.github.io/jubilant-journey/llms.txt |
| llms-full.txt | https://profyt.github.io/jubilant-journey/llms-full.txt |

## Repo layout (maintainers / agents editing this tree)

| Path | Role |
|------|------|
| `src/` | Library source |
| `site/` | VitePress docs (EN + `site/ru/`) |
| `examples/vite-react-todos/` | Live demo app (UI strings are English) |
| `docs/` | Repo markdown guides (API wording source) |
| `docs/publishing.md` | Dual publish to npmjs + GitHub Packages |
| `.github/workflows/publish.yml` | Tag / dispatch publish workflow |
| `llms.txt` / `llms-full.txt` | Agent crawler briefs (deployed to Pages root) |

## Tests before claiming success

```bash
npm run typecheck && npm test && npm run build
```

Docs: `npm run site:install && npm run docs:build` (from repo root scripts).
