import type { SyncConfig } from '../shared/protocol.js';
import type { CollectionSchema } from '../shared/schema.js';
import { DatabaseError } from '../shared/errors.js';
import type { RemoteSyncAdapter } from '../sync/RemoteSyncAdapter.js';
import { PortBridge, type OnConflictHandler } from './PortBridge.js';
import { resolveWorkerScriptUrl } from './resolveWorkerScriptUrl.js';

export interface SharedWorkerBridgeOptions {
  dbName: string;
  schema: CollectionSchema;
  sharedWorkerUrl: string | URL;
  remote?: RemoteSyncAdapter;
  sync?: SyncConfig;
  onConflict?: OnConflictHandler;
}

export async function connectSharedWorker(
  options: SharedWorkerBridgeOptions,
): Promise<PortBridge> {
  if (typeof SharedWorker === 'undefined') {
    throw new Error('SharedWorker is not supported in this environment');
  }

  // Root-relative paths (`/repo/assets/…`) must resolve against the origin so
  // SharedWorker works under GitHub Pages / non-root bases.
  const url = resolveWorkerScriptUrl(options.sharedWorkerUrl);

  const worker = new SharedWorker(url, {
    name: options.dbName,
    type: 'module',
  });

  worker.port.start();

  const bridge = new PortBridge(worker.port, {
    remote: options.remote,
    onConflict: options.onConflict,
  });

  const workerError = new Promise<never>((_, reject) => {
    worker.addEventListener(
      'error',
      () => {
        bridge.close();
        reject(
          new DatabaseError({
            code: 'WorkerDead',
            message: `SharedWorker failed to load: ${url}. Check sharedWorker URL and run library build (npm run build).`,
          }),
        );
      },
      { once: true },
    );
  });

  const syncConfig: SyncConfig | undefined =
    options.sync ??
    (options.remote ? { kind: 'delegate' } : undefined);

  await Promise.race([
    bridge.call({
      type: 'connect',
      dbName: options.dbName,
      schema: options.schema,
      syncCapable: Boolean(options.remote),
      sync: syncConfig,
    }),
    workerError,
  ]);

  return bridge;
}
