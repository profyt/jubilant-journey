# Architecture

High-level map of the client and workers. Source lives under `src/` in the repository.

## Components

| Component | Location | Role |
|-----------|----------|------|
| `createDatabase` | `src/client/createDatabase.ts` | Public API, wraps `PortBridge` |
| `PortBridge` | `src/client/PortBridge.ts` | RPC + events on `MessagePort` |
| `SharedWorkerBridge` | `src/client/SharedWorkerBridge.ts` | `new SharedWorker()` + connect |
| `MessageRouter` | `src/shared-worker/MessageRouter.ts` | Request dispatch |
| `ClientRegistry` | `src/shared-worker/ClientRegistry.ts` | Port map, subscriptions, fan-out |
| `DbEngine` | `src/shared-worker/DbEngine.ts` | IndexedDB CRUD |
| `RemoteSync` | `src/shared-worker/RemoteSync.ts` | Push/pull loop |

Dedicated worker reuses the same router/engine via an internal `MessageChannel` (`src/dedicated-worker/entry.ts`).

## Multi-tab fan-out

```
Tab A ──put──► SharedWorker ──IDB write──► response to Tab A
                    │
                    └── change event ──► Tab B (if subscribed)
```

`ClientRegistry` stores per-port subscriptions. `broadcastChange` posts `{ kind: 'change', collection, type, doc, id }` only to clients subscribed to that collection.

## IndexedDB layout

For schema `{ todos: { keyPath: 'id' } }`:

| Store | Purpose |
|-------|---------|
| `todos` | User collections |
| `_meta` | Sync cursor key-value |
| `sync_queue` | Pending `PendingOp` records |

## Schema versioning

`computeSchemaVersion(schema)` hashes collection names, key paths, and indexes into an integer used as IndexedDB `version`. Changing the schema triggers `upgrade` and creates new indexes/stores.

All tabs connecting to the same `dbName` must use an identical schema JSON shape or `connect` returns `SchemaMismatch`.

## Leader election (remote sync)

On `connect` with `syncCapable: true` (set when a `remote` adapter is provided):

1. First capable client becomes sync leader.
2. `RemoteSync` sends `sync:pull` / `sync:push` only to the leader port.
3. If leader disconnects, the next `syncCapable` client is promoted.

Fetch-mode sync runs HTTP inside the worker; delegate-mode HTTP runs on the leader tab.
