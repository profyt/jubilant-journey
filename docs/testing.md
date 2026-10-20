# Testing

## Unit tests

```bash
npm test
```

Vitest + `fake-indexeddb` against the SharedWorker core (`DbEngine`, `MessageRouter`, `RemoteSync`, React hooks). No real browser required.

## Persistence stress

```bash
npm test -- tests/persistence-stress.test.ts
```

Fake-IndexedDB stress: large sync queue drain, reopen same `dbName` mid-sync (pending retained then drained), soft large-payload `putMany` (not a real browser quota probe).

## Performance / load tests

```bash
npm run test:perf
```

Runs a separate Vitest config (`vitest.perf.config.ts`) that measures:

| Case | What |
|------|------|
| Throughput | Bulk put / get / index query (~300 docs) |
| Latency | Single-op put/get p50 / p95 (~80 samples) |
| Fan-out | Multi-client `subscribe` broadcast (~25 clients × 100 events) |
| Sync queue | Enqueue under load + mock remote push/pull |
| Ops growth | Queue stays empty without enqueue; drains after sync |

Metrics are printed as `[perf] …` JSON lines. Assertions use **soft ceilings** (catch catastrophic regressions only). On a slow runner:

```bash
PERF_MULTIPLIER=2 npm run test:perf
```

These tests exercise the same in-process worker core as unit tests — not Playwright / real SharedWorker e2e.

## Browser e2e benches (Playwright)

```bash
npm run example:install           # example has its own lockfile (vite)
npx playwright install chromium   # once per machine / CI image
npm run bench:e2e
```

Runs Chromium against the example’s `/bench.html` page with a **real SharedWorker + IndexedDB** (complements `test:perf`).

| Case | What |
|------|------|
| Throughput / latency | put/get/query through `createDatabase` in the browser |
| Cross-tab fan-out | **Hard CI gate:** two tabs, same `dbName`, SharedWorker `subscribe` sees puts; reader can `get` last doc |
| Sync round-trip | fast in-page mock remote (`?remote=1`), queue drains |

Throughput/latency/sync use soft ceilings (catastrophic regressions). Cross-tab fan-out **must** receive all events (no soft skip). Metrics: console `[bench:e2e] …` and `e2e-bench-results.json`. Slow runners:

```bash
PERF_MULTIPLIER=2 npm run bench:e2e
```

CI installs Chromium and runs `bench:e2e` after the unit/perf jobs.

### WebKit smoke (soft gate)

```bash
npx playwright install webkit
npm run bench:webkit
```

Separate Playwright config (`e2e/bench/playwright.webkit.config.ts`): put/get + cross-tab fan-out on Desktop Safari. CI job `webkit-smoke` uses `continue-on-error: true` until the path is stable enough to harden (SharedWorker may fall back to dedicated + BroadcastChannel).

## Marketing benchmark

```bash
npm run example:install
npx playwright install chromium   # once
npm run bench:marketing
```

Publishable Chromium comparison for README / docs (ops/s, latency, cross-tab fan-out).

| Side | Path | Role |
|------|------|------|
| worker-sync-db | `createDatabase` + SharedWorker → IndexedDB | Product under test |
| Dexie | Main-thread IndexedDB | Honest single-tab baseline on the same storage layer |

### What is comparable

- Same Chromium, same document shape `{ id, title, kind }`, same sequential awaited put/get counts, one equality index query.
- Latency: single-op put/get p50 / p95.

### What is not comparable

- **Multi-tab live subscribe** — measured only for worker-sync-db (Dexie column is “—”). Do not claim “faster than Dexie at multi-tab.”
- Remote sync / queue (covered by regression benches, not marketing copy).
- CI absolute numbers vs a laptop run — regenerate both sides together before publishing.

### Artifacts & CI

| Output | Purpose |
|--------|---------|
| `docs/benchmarks/marketing-latest.json` | Machine-readable last committed run |
| `docs/benchmarks/marketing-snippet.md` | Markdown table fragment |
| README Performance markers | Updated in place by `bench:marketing` |
| `marketing-bench-results.json` | Local/CI run copy (gitignored) |

Local `npm run bench:marketing` rewrites committed docs + README. CI uses `npm run bench:marketing:ci` (`MARKETING_BENCH_COMMIT=0`) with **`continue-on-error: true`** — smoke/report only, uploads the JSON artifact, never fails the PR on ops/s variance and never commits README numbers from the runner.
