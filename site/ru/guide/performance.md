# Производительность

Сравнимые цифры Chromium для документации и README — **не** soft-ceiling регрессионные сюиты (`test:perf` / `bench:e2e`).

## Что измеряем

Последовательные put/get + index query через `createDatabase` (`mode: 'shared'`) против тех же форм на **Dexie** (IndexedDB в main thread). Плюс число **cross-tab subscribe fan-out** для продукта SharedWorker (у Dexie в этом бенче нет эквивалентного пути).

## Оговорки

- Только одна машина / один прогон — абсолютные ops/s зависят от загрузки CPU; смотрите соотношения внутри одного прогона.
- Dexie — честный baseline IndexedDB для **CRUD в одной вкладке**. Он **не** включает live sync через SharedWorker.
- worker-sync-db платит за **RPC + SharedWorker** на каждой операции; это осознанно — цена консистентности между вкладками.

## Актуальный marketing-сниппет

Закоммиченные результаты `npm run bench:marketing` лежат в репозитории в [`docs/benchmarks/`](https://github.com/profyt/jubilant-journey/tree/main/docs/benchmarks).

| Workload | worker-sync-db | Dexie (baseline) | Notes |
|----------|----------------:|-----------------:|-------|
| Put throughput (200 sequential) | **2.69k ops/s** | **4.45k ops/s** | Same docs; WSD pays SharedWorker RPC |
| Get throughput (200 sequential) | **8.44k ops/s** | **14.18k ops/s** | Key lookup |
| Put latency p50 / p95 | 0.20 / 0.50 ms | 0.20 / 0.40 ms | Single-op samples (n=50) |
| Get latency p50 / p95 | 0.10 / 0.20 ms | 0.10 / 0.20 ms | Single-op samples (n=50) |
| Cross-tab fan-out (40 puts → 2nd tab) | **690 events/s** (58.0 ms wall) | — | Dexie has no SharedWorker multi-tab path |

_Последний прогон: 2026-10-09 · Chromium (Playwright Desktop Chrome)_

## Интерактивные бенчи

В сборке демо также есть опциональные страницы бенчей (тот же деплой Pages):

- [Throughput bench](https://profyt.github.io/jubilant-journey/bench.html)
- [Marketing bench](https://profyt.github.io/jubilant-journey/marketing-bench.html)

Пересобирайте закоммиченные сниппеты после заметных изменений клиента/worker — см. [`docs/benchmarks/README.md`](https://github.com/profyt/jubilant-journey/blob/main/docs/benchmarks/README.md).
