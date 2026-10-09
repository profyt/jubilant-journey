import type {
  ChangeEventPayload,
  QueryFilter,
  SyncConfig,
  WorkerEvent,
} from '../shared/protocol.js';
import type {
  CollectionSchema,
  InferDoc,
  QueryOptions,
} from '../shared/schema.js';
import type {
  FetchSyncConfig,
  RemoteSyncAdapter,
  SyncStatus,
} from '../sync/RemoteSyncAdapter.js';
import { dedicatedWorkerUrl, sharedWorkerUrl } from '../workerUrls.js';
import { connectDedicatedWorker } from './DedicatedWorkerBridge.js';
import type { PortBridge } from './PortBridge.js';
import { connectSharedWorker } from './SharedWorkerBridge.js';

export type WorkerMode = 'auto' | 'shared' | 'dedicated';

export type RemoteConfig = RemoteSyncAdapter | FetchSyncConfig;

export interface CreateDatabaseOptions<S extends CollectionSchema> {
  schema: S;
  dbName: string;
  sharedWorker?: string | URL;
  dedicatedWorker?: string | URL;
  mode?: WorkerMode;
  remote?: RemoteConfig;
  onConflict?: (conflict: { opId: string; reason: string }) => void;
}

export type ChangeEvent<T> = {
  type: 'put' | 'delete';
  collection: string;
  doc: T | null;
  id: string;
};

export interface DatabaseClient<S extends CollectionSchema> {
  get<C extends keyof S & string>(
    collection: C,
    id: string,
  ): Promise<InferDoc<S, C> | null>;
  put<C extends keyof S & string>(
    collection: C,
    doc: Record<string, unknown> & { id: string },
  ): Promise<InferDoc<S, C>>;
  delete<C extends keyof S & string>(
    collection: C,
    id: string,
  ): Promise<InferDoc<S, C>>;
  query<C extends keyof S & string>(
    collection: C,
    opts?: QueryOptions,
  ): Promise<InferDoc<S, C>[]>;
  subscribe<C extends keyof S & string>(
    collection: C,
    listener: (event: ChangeEvent<InferDoc<S, C>>) => void,
    filter?: QueryFilter,
  ): () => void;
  syncNow(): Promise<SyncStatus>;
  getSyncStatus(): Promise<SyncStatus>;
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void;
  close(): void;
}

export function isSharedWorkerSupported(): boolean {
  return typeof SharedWorker !== 'undefined';
}

export function resolveWorkerMode(mode: WorkerMode = 'auto'): 'shared' | 'dedicated' {
  if (mode === 'shared') {
    if (!isSharedWorkerSupported()) {
      throw new Error('SharedWorker is not supported');
    }
    return 'shared';
  }
  if (mode === 'dedicated') {
    return 'dedicated';
  }
  return isSharedWorkerSupported() ? 'shared' : 'dedicated';
}

function isFetchSyncConfig(remote: RemoteConfig): remote is FetchSyncConfig {
  return 'pullUrl' in remote && 'pushUrl' in remote;
}

export async function createDatabase<S extends CollectionSchema>(
  options: CreateDatabaseOptions<S>,
): Promise<DatabaseClient<S>> {
  if (typeof window === 'undefined') {
    throw new Error(
      'createDatabase requires a browser environment (window is undefined)',
    );
  }

  const resolvedMode = resolveWorkerMode(options.mode);
  const remoteAdapter = options.remote && !isFetchSyncConfig(options.remote)
    ? options.remote
    : undefined;
  const sync: SyncConfig | undefined =
    options.remote && isFetchSyncConfig(options.remote)
      ? { kind: 'fetch', ...options.remote }
      : remoteAdapter
        ? { kind: 'delegate' }
        : undefined;

  const resolvedSharedWorker = options.sharedWorker ?? sharedWorkerUrl;
  const resolvedDedicatedWorker = options.dedicatedWorker ?? dedicatedWorkerUrl;

  let bridge: PortBridge;
  if (resolvedMode === 'shared') {
    bridge = await connectSharedWorker({
      dbName: options.dbName,
      schema: options.schema,
      sharedWorkerUrl: resolvedSharedWorker,
      remote: remoteAdapter,
      sync,
      onConflict: options.onConflict,
    });
  } else {
    bridge = await connectDedicatedWorker({
      dbName: options.dbName,
      schema: options.schema,
      dedicatedWorkerUrl: resolvedDedicatedWorker,
      remote: remoteAdapter,
      sync,
      onConflict: options.onConflict,
    });
  }

  return createClientFromBridge(bridge);
}

function createClientFromBridge<S extends CollectionSchema>(
  bridge: PortBridge,
): DatabaseClient<S> {
  const localSubscriptions = new Map<
    string,
    Set<(event: ChangeEvent<InferDoc<S, string>>) => void>
  >();

  bridge.onEvent((event: WorkerEvent) => {
    if (event.kind !== 'change') return;
    const payload = event as ChangeEventPayload;
    const listeners = localSubscriptions.get(payload.collection);
    if (!listeners) return;
    const changeEvent: ChangeEvent<InferDoc<S, string>> = {
      type: payload.type,
      collection: payload.collection,
      doc: payload.doc as InferDoc<S, string> | null,
      id: payload.id,
    };
    for (const listener of listeners) {
      listener(changeEvent);
    }
  });

  return {
    async get(collection, id) {
      return bridge.call({
        type: 'get',
        collection,
        id,
      }) as Promise<InferDoc<S, typeof collection> | null>;
    },

    async put(collection, doc) {
      return bridge.call({
        type: 'put',
        collection,
        doc,
      }) as Promise<InferDoc<S, typeof collection>>;
    },

    async delete(collection, id) {
      return bridge.call({
        type: 'delete',
        collection,
        id,
      }) as Promise<InferDoc<S, typeof collection>>;
    },

    async query(collection, opts = {}) {
      return bridge.call({
        type: 'query',
        collection,
        index: opts.index,
        range: opts.range,
        limit: opts.limit,
        includeDeleted: opts.includeDeleted,
      }) as Promise<InferDoc<S, typeof collection>[]>;
    },

    subscribe(collection, listener, filter) {
      let listeners = localSubscriptions.get(collection);
      if (!listeners) {
        listeners = new Set();
        localSubscriptions.set(collection, listeners);
        void bridge.call({ type: 'subscribe', collection, filter });
      }
      listeners.add(listener as (event: ChangeEvent<InferDoc<S, string>>) => void);

      return () => {
        const set = localSubscriptions.get(collection);
        if (!set) return;
        set.delete(listener as (event: ChangeEvent<InferDoc<S, string>>) => void);
        if (set.size === 0) {
          localSubscriptions.delete(collection);
          void bridge.call({ type: 'unsubscribe', collection });
        }
      };
    },

    async syncNow() {
      return bridge.call({ type: 'syncNow' }) as Promise<SyncStatus>;
    },

    async getSyncStatus() {
      return bridge.call({ type: 'getSyncStatus' }) as Promise<SyncStatus>;
    },

    onSyncStatusChange(listener) {
      return bridge.onEvent((event) => {
        if (event.kind === 'syncStatus') {
          listener(event.status);
        }
      });
    },

    close() {
      void bridge.call({ type: 'disconnect' });
      bridge.close();
    },
  };
}
