# Multi-tab

worker-sync-db keeps every open tab on the same origin in sync through a **SharedWorker** named by your `dbName`.

## How it works

1. Each tab calls `createDatabase` with the same `schema` and `dbName`.
2. Tabs connect to one SharedWorker (when the browser supports it).
3. Local `put` / `delete` write to IndexedDB in the worker.
4. The worker broadcasts `change` events to ports that called `subscribe` on that collection.

```typescript
const unsub = db.subscribe('todos', (event) => {
  if (event.type === 'put') {
    // refresh UI with event.doc
  }
});
```

React: [`useQuery`](/guide/react) subscribes for you; [`useSubscribe`](/guide/react) exposes the raw stream.

## Requirements

| Requirement | Why |
|-------------|-----|
| Same `dbName` | SharedWorker scope + IndexedDB name |
| Same `schema` | Otherwise `SchemaMismatch` |
| Same origin | Browser SharedWorker isolation |
| Active `subscribe` per tab | Fan-out only to subscribed ports |
| `mode: 'auto'` or `'shared'` | Dedicated mode is per-tab only |

## Browser support

- **SharedWorker** — Chromium and Firefox. Required for cross-tab sync.
- **Safari / some WebViews** — no SharedWorker. With `mode: 'auto'`, the library falls back to a dedicated worker (**no cross-tab sync**).

```typescript
const db = await createDatabase({
  schema,
  dbName: 'my-app',
  mode: 'auto',
  sharedWorker: sharedWorkerUrl,
  dedicatedWorker: dedicatedWorkerUrl,
});
```

## Try it

1. Open the [live demo](/demo/).
2. Duplicate the tab.
3. Add or toggle a todo — the other tab updates immediately.

## Troubleshooting

If changes do not appear in another tab, see [Troubleshooting](/guide/troubleshooting#changes-not-appearing-in-another-tab). Architecture detail: [Architecture](/guide/architecture).
