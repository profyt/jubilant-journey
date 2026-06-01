import type { SyncConfig } from '../shared/protocol.js';
import type { CollectionSchema } from '../shared/schema.js';
import type { RemoteSyncAdapter } from '../sync/RemoteSyncAdapter.js';
import { PortBridge, type OnConflictHandler } from './PortBridge.js';

export interface DedicatedWorkerBridgeOptions {
  dbName: string;
  schema: CollectionSchema;
  dedicatedWorkerUrl: string | URL;
  remote?: RemoteSyncAdapter;
  sync?: SyncConfig;
  onConflict?: OnConflictHandler;
}

export async function connectDedicatedWorker(
  options: DedicatedWorkerBridgeOptions,
): Promise<PortBridge> {
  const url =
    options.dedicatedWorkerUrl instanceof URL
      ? options.dedicatedWorkerUrl.href
      : options.dedicatedWorkerUrl;

  const worker = new Worker(url, { type: 'module' });

  const port = await new Promise<MessagePort>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Dedicated worker port handshake timeout'));
    }, 10_000);

    worker.addEventListener('message', function onMessage(event: MessageEvent) {
      if (event.data?.type === 'port' && event.ports[0]) {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        resolve(event.ports[0]);
      }
    });

    worker.addEventListener('error', (e) => {
      clearTimeout(timer);
      reject(e.error ?? new Error('Dedicated worker failed'));
    });
  });

  const bridge = new PortBridge(port, {
    remote: options.remote,
    onConflict: options.onConflict,
  });

  worker.addEventListener('error', () => {
    bridge.close();
  });

  const syncConfig: SyncConfig | undefined =
    options.sync ??
    (options.remote ? { kind: 'delegate' } : undefined);

  await bridge.call({
    type: 'connect',
    dbName: options.dbName,
    schema: options.schema,
    syncCapable: Boolean(options.remote),
    sync: syncConfig,
  });

  return bridge;
}
