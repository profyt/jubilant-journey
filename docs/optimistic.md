# Optimistic UI helpers

Thin helpers for **local-first UI** patterns. Conflicts and remote merge remain **last-write-wins** — there is no CRDT.

## Temp ids

```typescript
import { createTempId, isTempId } from 'worker-sync-db';

const id = createTempId(); // tmp_<uuid>
if (isTempId(id)) {
  // still a client placeholder — replace after your API assigns a stable id if needed
}
```

Use a temp id in `put` so the UI can render immediately. If your backend returns a different id, `put` the server doc and `delete` the temp row (or keep the temp id if your API accepts client ids).

## `withOptimisticPut`

Local `put` → your async work → on failure, best-effort soft-delete of that row:

```typescript
import { createTempId, withOptimisticPut } from 'worker-sync-db';

await withOptimisticPut(
  db,
  'todos',
  { id: createTempId(), title: 'Milk', status: 'open' },
  async (saved) => {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saved),
    });
    if (!res.ok) throw new Error('create failed');
  },
);
```

### Limits

- Rollback is a soft-delete; if sync is configured, both put and delete may enqueue — prefer calling this **before** enabling remote sync for that flow, or accept LWW queue ops.
- Does not wrap `syncNow` / push failures automatically; bind to your own network call.
- Not a general transaction across UI + remote — for multi-collection atomic local writes see `batch()`.
