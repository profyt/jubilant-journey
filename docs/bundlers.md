# Bundler setup

worker-sync-db ships three entry points. Your bundler must emit **separate files** for worker scripts.

## Vite

### Install and import

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

`sharedWorkerUrl` and `dedicatedWorkerUrl` are `URL` objects built with `new URL('./shared-worker/entry.js', import.meta.url)` **inside the package** (`dist/index.js` → `dist/shared-worker/entry.js`). Bundlers (Vite, Webpack 5) detect this pattern in `node_modules` and emit worker chunks.

You can omit both options — `createDatabase` uses these exports as defaults.

**Do not** write `new URL('worker-sync-db/shared-worker', import.meta.url)` in app code — aliases are not applied there (often causes `Port closed`).

### Alternative: explicit `?url` import (Vite)

```typescript
import sharedWorkerUrl from 'worker-sync-db/dist/shared-worker/entry.js?url';
```

Useful if your toolchain does not trace `new URL` in dependencies.

### Local monorepo / `file:` dependency

When linking the library from the repo root:

```json
"worker-sync-db": "file:../.."
```

Point URLs at `dist` after building the library:

```typescript
sharedWorker: new URL(
  '../../node_modules/worker-sync-db/dist/shared-worker/entry.js',
  import.meta.url,
),
```

Or use alias in `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'worker-sync-db': path.resolve(__dirname, '../..'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  optimizeDeps: {
    exclude: ['worker-sync-db'],
  },
});
```

### Optional: explicit worker import

```typescript
import SharedWorkerUrl from 'worker-sync-db/shared-worker?url';
// use sharedWorker: SharedWorkerUrl
```

## Webpack 5

Use `new URL(..., import.meta.url)` with `module.parser.javascript.importMeta` enabled (default in Webpack 5).

```typescript
sharedWorker: new URL(
  'worker-sync-db/dist/shared-worker/entry.js',
  import.meta.url,
),
```

Configure `output.workerChunkFilename` if you customize worker output.

## Dedicated worker only

If you force `mode: 'dedicated'`, only `dedicatedWorker` URL is required:

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'dedicated',
  dedicatedWorker: new URL('worker-sync-db/dedicated-worker', import.meta.url),
});
```

## Checklist

- [ ] `sharedWorker` URL passed to `createDatabase`
- [ ] `dedicatedWorker` URL passed when using `mode: 'auto'`
- [ ] Library built (`npm run build` in package) before consuming `file:` link
- [ ] Same `dbName` and `schema` in all tabs
