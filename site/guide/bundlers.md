# Install & bundlers

worker-sync-db ships four entry points. Your bundler must emit **separate files** for worker scripts.

| Export | Purpose |
|--------|---------|
| `worker-sync-db` | Core client (`createDatabase`, schema helpers) |
| `worker-sync-db/react` | Optional React hooks |
| `worker-sync-db/shared-worker` | SharedWorker entry |
| `worker-sync-db/dedicated-worker` | DedicatedWorker fallback |

## Install

```bash
npm install worker-sync-db
```

```typescript
import {
  createDatabase,
  sharedWorkerUrl,
  dedicatedWorkerUrl,
} from 'worker-sync-db';

const db = await createDatabase({
  schema,
  dbName: 'my-app',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
  mode: 'auto',
});
```

`sharedWorkerUrl` and `dedicatedWorkerUrl` are `URL` objects built with `new URL('./shared-worker/entry.js', import.meta.url)` **inside the package**. Bundlers (Vite, Webpack 5) detect this pattern in `node_modules` and emit worker chunks.

Worker entry bundles **inline `idb`** so they are self-contained.

You can omit both options — `createDatabase` uses these exports as defaults.

::: warning Do not use bare package paths in `new URL`
Do **not** write `new URL('worker-sync-db/shared-worker', import.meta.url)` in app code — aliases are not applied there and often cause `Port closed`. Prefer `sharedWorkerUrl` / `dedicatedWorkerUrl`.
:::

## Vite — explicit `?url` import

```typescript
import sharedWorkerUrl from 'worker-sync-db/dist/shared-worker/entry.js?url';
```

Useful if your toolchain does not trace `new URL` in dependencies.

## Local monorepo / `file:` dependency

When linking the library from this repo:

```json
"worker-sync-db": "file:../.."
```

Build the library first (`npm run build` at the repo root), then point URLs at `dist` or use resolve aliases as in [examples/vite-react-todos](https://github.com/profyt/jubilant-journey/tree/main/examples/vite-react-todos).

## Webpack 5

Use `new URL(..., import.meta.url)` with `module.parser.javascript.importMeta` enabled (default in Webpack 5).

```typescript
sharedWorker: new URL(
  'worker-sync-db/dist/shared-worker/entry.js',
  import.meta.url,
),
```

## Dedicated worker only

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'dedicated',
  dedicatedWorker: dedicatedWorkerUrl,
});
```

Dedicated mode has **no cross-tab sync**. Prefer `mode: 'auto'` when possible.

## Checklist

- [ ] `sharedWorker` URL passed (or default export used)
- [ ] `dedicatedWorker` URL passed when using `mode: 'auto'`
- [ ] Library built before consuming a `file:` link
- [ ] Same `dbName` and `schema` in all tabs
