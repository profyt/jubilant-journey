# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Docs: schema migrations / semver checklist (`docs/migrations.md`)
- Persistence stress tests: large queue, reload mid-sync, soft large-payload check
- `getDiagnostics()` — worker mode, cross-tab transport, queue depth, last sync error
- Optimistic UI helpers: `createTempId` / `isTempId` / `withOptimisticPut` (+ docs pattern; LWW, not CRDT)
- `useLiveQuery` alias + client-side `QueryOptions.filter` / `orderBy` for live query ergonomics
- `pauseSync()` / `resumeSync()` and `SyncStatus.paused`; fetch-mode `onConflict` via worker conflict events; sync docs (auth headers, progress UX)
- `batch(ops)` — multi-collection put/delete in one IndexedDB transaction (see API limits)
- `defineCollection<TDoc>()` + stronger `InferDoc` / `DocInput` so typed schemas flow into `get`/`put`/`query` (plain schemas unchanged)
- Dedicated-mode DX: `getWorkerMode()` / `getCrossTabTransport()`, optional `BroadcastChannel` cross-tab relay (`crossTabFallback`, default `auto`)

### Changed

- CI: soft WebKit Playwright smoke job (`webkit-smoke`, continue-on-error) for put/get + cross-tab
- E2E: cross-tab SharedWorker fan-out asserts document visibility on the reader tab (hard CI gate)
- Schema migrations: compatible additive schema changes on reconnect; `describeSchemaChange()` helper; clearer `SchemaMismatch` for breaking changes
- Sync scheduler: debounce after mutations, exponential backoff + jitter on failure, `SyncStatus.nextSyncAt`
- `count(collection, opts?)` — count matching docs (index/range; soft-deleted excluded by default)
- Bulk writes: `putMany`, `deleteMany`, and soft-delete `clear` on `DatabaseClient` (single IDB transaction per call)

## [0.1.1] - 2026-10-12

### Added

- Agent discoverability files in the published tarball: `AGENTS.md`, `llms.txt`, `llms-full.txt`
- Dual-publish CI: npmjs (`worker-sync-db`) + GitHub Packages (`@profyt/worker-sync-db`) on `v*` tags (see `docs/publishing.md`)
- Russian VitePress docs locale and polished RU copy on the Pages site (docs-only; not runtime API)

### Changed

- Package metadata: richer `keywords`, `repository` / `homepage` for npm and GitHub Packages linking

## [0.1.0] - 2026-10-09

### Added

- Initial `createDatabase` client: typed `get` / `put` / `delete` / `query` / `subscribe`
- SharedWorker + DedicatedWorker fallback (`mode: 'auto' | 'shared' | 'dedicated'`)
- Offline-first remote sync (delegate adapter or fetch config)
- React hooks export (`worker-sync-db/react`): `useQuery`, `useSubscribe`, `useSyncStatus`, `DatabaseProvider`
- Package metadata for npm publish (`exports`, `files`, `sideEffects`, `LICENSE`)
- GitHub Pages docs site (VitePress) alongside the live demo: guides, TypeScript/React examples, Demo ↔ Docs navigation

### Fixed

- Remote pull changes now fan out to `subscribe` listeners
- Sync queue only enqueues when `remote` is configured
- `IDBKeyRange` construction for only / lowerBound / upperBound

[0.1.1]: https://github.com/profyt/jubilant-journey/releases/tag/v0.1.1
[0.1.0]: https://github.com/profyt/jubilant-journey/releases/tag/v0.1.0
