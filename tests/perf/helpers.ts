/** Shared helpers for CI-safe performance / load checks. */

export type LatencyStats = {
  count: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
  maxMs: number;
};

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

export function latencyStats(samplesMs: number[]): LatencyStats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = samplesMs.reduce((a, b) => a + b, 0);
  return {
    count: samplesMs.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    meanMs: samplesMs.length ? sum / samplesMs.length : 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export async function timeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - start };
}

export function reportMetric(name: string, value: Record<string, unknown>): void {
  // Visible in CI logs; not asserted unless paired with a soft threshold.
  console.info(`[perf] ${name}`, JSON.stringify(value));
}

/**
 * Soft ceiling: fails only on catastrophic regressions.
 * Override via PERF_MULTIPLIER (e.g. 2 on slow runners).
 */
export function softCeilingMs(baselineMs: number): number {
  const mult = Number(process.env.PERF_MULTIPLIER ?? '1');
  const safe = Number.isFinite(mult) && mult > 0 ? mult : 1;
  return baselineMs * safe;
}
