/**
 * Resolved from this package's `dist/` layout after build.
 * Pass to `createDatabase({ sharedWorker, dedicatedWorker })`.
 *
 * Vite/webpack follow `new URL(..., import.meta.url)` in dependencies and
 * emit worker assets when you import these from `worker-sync-db`.
 */
export const sharedWorkerUrl = new URL(
  './shared-worker/entry.js',
  import.meta.url,
);

export const dedicatedWorkerUrl = new URL(
  './dedicated-worker/entry.js',
  import.meta.url,
);
