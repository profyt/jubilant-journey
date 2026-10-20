# Schema migrations & semver checklist

worker-sync-db versions the IndexedDB database from a **hash of the schema** (`computeSchemaVersion`). On `connect`, compatible changes upgrade automatically; incompatible ones throw `SchemaMismatch`.

Conflicts remain **last-write-wins** on `_updatedAt` / `_version` — not CRDT.

## Compatible vs breaking

| Change | Kind | What happens |
|--------|------|----------------|
| Add a collection | Compatible | New object store created on upgrade |
| Add an index | Compatible | Index created on existing store |
| Remove a collection | Compatible | Store deleted on upgrade |
| Change `keyPath` | **Breaking** | `SchemaMismatch` — use new `dbName` or wipe |
| Change an index’s key path | **Breaking** | `SchemaMismatch` |
| Rename a collection | **Breaking** | Treated as remove + add (data not moved) |

Tooling: `describeSchemaChange(previous, next)` → `{ kind: 'identical' \| 'compatible' \| 'incompatible', detail? }`.

## Shipping checklist

Before releasing an app (or library demo) that changes the schema:

1. **Classify** the change with `describeSchemaChange` in CI or a small script.
2. **Additive only?** Ship with the same `dbName`; all tabs must reload onto the new schema (old tabs keep working until they reconnect — then they upgrade).
3. **Breaking?** Pick one:
   - New `dbName` (e.g. `my-app-v2`) and optional one-shot data copy in app code, or
   - Document that users must clear site data / IndexedDB.
4. **Semver for apps** depending on this package:
   - Additive schema in *your* app → typically a **minor** app release (clients auto-migrate).
   - Breaking schema / new `dbName` → **major** (or explicit migration notes).
5. **Library consumers of worker-sync-db:** follow [Keep a Changelog](../CHANGELOG.md) — runtime API breaks are majors; additive APIs are minors.
6. **Multi-tab:** ensure every tab uses the **same** `dbName` + schema after deploy; mixed schemas on one name will fail connect for the incompatible tab.
7. **Sync:** pending ops stay in `sync_queue` across reloads; after a breaking `dbName` change the old queue is abandoned with the old DB.
8. **Tests:** cover `describeSchemaChange` + reopen with the new schema (see `tests/schema-migrate.test.ts`).

## Example — additive index

```typescript
import { describeSchemaChange } from 'worker-sync-db';

const previous = {
  todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
};
const next = {
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status', byTitle: 'title' },
  },
};

const change = describeSchemaChange(previous, next);
// { kind: 'compatible' }
```

## See also

- [troubleshooting.md](troubleshooting.md) — `SchemaMismatch`
- [api.md](api.md) — `describeSchemaChange` / `computeSchemaVersion`
- [getting-started.md](getting-started.md) — schema basics
