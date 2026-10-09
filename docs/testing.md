# Testing

## Unit tests

```bash
npm test
```

Vitest + `fake-indexeddb` against the SharedWorker core (`DbEngine`, `MessageRouter`, `RemoteSync`, React hooks). No real browser required.

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
