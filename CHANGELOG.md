# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Pages docs site (VitePress) alongside the live demo: guides, TypeScript/React examples, Demo ↔ Docs navigation

## [0.1.0] - 2026-10-09

### Added

- Initial `createDatabase` client: typed `get` / `put` / `delete` / `query` / `subscribe`
- SharedWorker + DedicatedWorker fallback (`mode: 'auto' | 'shared' | 'dedicated'`)
- Offline-first remote sync (delegate adapter or fetch config)
- React hooks export (`worker-sync-db/react`): `useQuery`, `useSubscribe`, `useSyncStatus`, `DatabaseProvider`
- Package metadata for npm publish (`exports`, `files`, `sideEffects`, `LICENSE`)

### Fixed

- Remote pull changes now fan out to `subscribe` listeners
- Sync queue only enqueues when `remote` is configured
- `IDBKeyRange` construction for only / lowerBound / upperBound

[0.1.0]: https://github.com/profyt/jubilant-journey/releases/tag/v0.1.0
