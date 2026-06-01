# Troubleshooting

## `SchemaMismatch`

**Cause:** A tab connected with a different `schema` than the first client that opened `dbName`.

**Fix:**

- Deploy schema changes atomically (all users reload).
- Use a new `dbName` for breaking schema changes.
- Clear IndexedDB in DevTools during development.

## Changes not appearing in another tab

**Checklist:**

1. Using `mode: 'shared'` or `'auto'` (not `dedicated`).
2. Second tab called `db.subscribe('collection', listener)`.
3. Same `dbName` and origin.
4. SharedWorker still running (DevTools → Application → Shared workers).

## `SharedWorker is not supported`

Some WebViews and older browsers lack SharedWorker.

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'auto', // falls back to dedicated
  dedicatedWorker: new URL('worker-sync-db/dedicated-worker', import.meta.url),
});
```

Dedicated mode: **no cross-tab sync**.

## `Port closed` or worker failed to load

**Cause:** SharedWorker script returned 404 or failed to parse. Common with:

```typescript
// Wrong in Vite apps — alias is not applied to new URL(...)
new URL('worker-sync-db/shared-worker', import.meta.url)
```

The worker `error` handler closes the port; the next RPC throws `Port closed`.

**Fix:**

```typescript
import { createDatabase, sharedWorkerUrl, dedicatedWorkerUrl } from 'worker-sync-db';

await createDatabase({ sharedWorker: sharedWorkerUrl, dedicatedWorker: dedicatedWorkerUrl, ... });
// or omit both — they are the defaults
```

- Build the library: `npm run build` in package root (required for `file:../..` link).
- See [bundlers.md](bundlers.md).

## `createDatabase requires a browser environment`

Called during SSR or in Node tests without `window`. Initialize only in `useEffect` / client entry.

## Sync never completes / `pending` stays high

1. Check `status.lastError` via `getSyncStatus()`.
2. Verify leader tab is open (delegate mode).
3. Confirm push returns `applied` opIds matching queued `opId`s.
4. Network offline: `status.online === false` until `online` event.

## IndexedDB `QuotaExceededError`

Common in Safari private mode or full disk. Catch storage errors and warn users; reduce stored payload size.

## DevTools

| Tool | Location |
|------|----------|
| SharedWorker console | Application → Shared workers → your `dbName` |
| IndexedDB | Application → IndexedDB → `dbName` |
| Pending sync ops | `sync_queue` object store |

## Timeouts (`DbError: Timeout`)

Default RPC timeout is 30 seconds. Large pull payloads or blocked main thread on leader tab can delay delegate responses. Keep adapter `pull`/`push` fast or increase timeout via low-level `PortBridge` options.
