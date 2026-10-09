# Performance notes

Comparable Chromium numbers for docs and README — **not** the soft-ceiling regression suites (`test:perf` / `bench:e2e`).

## What we measure

Sequential put/get + index query through `createDatabase` (`mode: 'shared'`) vs the same shapes on **Dexie** (main-thread IndexedDB). Plus a **cross-tab subscribe fan-out** number for the SharedWorker product story (Dexie has no equivalent path in this bench).

## Caveats

- Same machine / same run only — absolute ops/s move with CPU load; prefer ratios from one run.
- Dexie is a fair IndexedDB baseline for **single-tab CRUD**. It does **not** include SharedWorker multi-tab live sync.
- worker-sync-db pays **RPC + SharedWorker** overhead on every op; that is intentional and what you buy multi-tab consistency with.

## Latest marketing snippet

Committed outputs from `npm run bench:marketing` live in the repo under [`docs/benchmarks/`](https://github.com/profyt/jubilant-journey/tree/main/docs/benchmarks).

| Workload | worker-sync-db | Dexie (baseline) | Notes |
|----------|----------------:|-----------------:|-------|
| Put throughput (200 sequential) | **2.69k ops/s** | **4.45k ops/s** | Same docs; WSD pays SharedWorker RPC |
| Get throughput (200 sequential) | **8.44k ops/s** | **14.18k ops/s** | Key lookup |
| Put latency p50 / p95 | 0.20 / 0.50 ms | 0.20 / 0.40 ms | Single-op samples (n=50) |
| Get latency p50 / p95 | 0.10 / 0.20 ms | 0.10 / 0.20 ms | Single-op samples (n=50) |
| Cross-tab fan-out (40 puts → 2nd tab) | **690 events/s** (58.0 ms wall) | — | Dexie has no SharedWorker multi-tab path |

_Last run: 2026-10-09 · Chromium (Playwright Desktop Chrome)_

## Interactive benches

The demo build also ships optional bench pages (same Pages deploy):

- [Throughput bench](https://profyt.github.io/jubilant-journey/bench.html)
- [Marketing bench](https://profyt.github.io/jubilant-journey/marketing-bench.html)

Regenerate committed snippets after meaningful client/worker changes — see [`docs/benchmarks/README.md`](https://github.com/profyt/jubilant-journey/blob/main/docs/benchmarks/README.md).
