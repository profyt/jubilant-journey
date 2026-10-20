import type {
  BatchOp,
  BatchResultItem,
  ChangeEventPayload,
  QueryFilter,
  SyncConfig,
  WorkerEvent,
} from '../shared/protocol.js';
import type {
  CollectionSchema,
  DocInput,
  InferDoc,
  QueryOptions,
} from '../shared/schema.js';
import type {
  FetchSyncConfig,
  RemoteSyncAdapter,
  SyncStatus,
} from '../sync/RemoteSyncAdapter.js';
import { dedicatedWorkerUrl, sharedWorkerUrl } from '../workerUrls.js';
import { applyClientQueryOptions } from './applyClientQuery.js';
import { createCrossTabBroadcaster } from './crossTabBroadcast.js';
import { connectDedicatedWorker } from './DedicatedWorkerBridge.js';
import type { PortBridge } from './PortBridge.js';
import { connectSharedWorker } from './SharedWorkerBridge.js';

export type WorkerMode = 'auto' | 'shared' | 'dedicated';

/** How to fan out live changes when SharedWorker is unavailable. */
export type CrossTabFallback = 'none' | 'broadcast-channel' | 'auto';

export type CrossTabTransport = 'shared-worker' | 'broadcast-channel' | 'none';

/** Snapshot for debugging worker / sync health (read-only). */
export type DatabaseDiagnostics = {
  workerMode: 'shared' | 'dedicated';
  crossTabTransport: CrossTabTransport;
  /** Alias of `pending` — ops waiting in the sync queue. */
  queueDepth: number;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  nextSyncAt: number | null;
  online: boolean;
  paused: boolean;
};

export type RemoteConfig = RemoteSyncAdapter | FetchSyncConfig;

export interface CreateDatabaseOptions<S extends CollectionSchema> {
  schema: S;
  dbName: string;
  sharedWorker?: string | URL;
  dedicatedWorker?: string | URL;
  mode?: WorkerMode;
  /**
   * Cross-tab live updates when resolved mode is `dedicated`.
   * - `auto` (default): use `BroadcastChannel` in dedicated mode
   * - `broadcast-channel`: always enable BC relay (even alongside SharedWorker — usually unnecessary)
   * - `none`: no cross-tab relay in dedicated mode
   */
  crossTabFallback?: CrossTabFallback;
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
  /** Resolved runtime worker mode (`shared` or `dedicated`). */
  getWorkerMode(): 'shared' | 'dedicated';
  /** How live multi-tab changes are delivered. */
  getCrossTabTransport(): CrossTabTransport;
  get<C extends keyof S & string>(
    collection: C,
    id: string,
  ): Promise<InferDoc<S, C> | null>;
  put<C extends keyof S & string>(
    collection: C,
    doc: DocInput<S, C>,
  ): Promise<InferDoc<S, C>>;
  putMany<C extends keyof S & string>(
    collection: C,
    docs: Array<Record<string, unknown> & { id: string }>,
  ): Promise<InferDoc<S, C>[]>;
  delete<C extends keyof S & string>(
    collection: C,
    id: string,
  ): Promise<InferDoc<S, C>>;
  deleteMany<C extends keyof S & string>(
    collection: C,
    ids: string[],
  ): Promise<InferDoc<S, C>[]>;
  /** Soft-delete all non-deleted documents in the collection. */
  clear<C extends keyof S & string>(collection: C): Promise<InferDoc<S, C>[]>;
  /**
   * Apply put/delete ops across collections in one IndexedDB transaction.
   * Missing delete targets are skipped. See docs for IDB limits.
   */
  batch(ops: BatchOp[]): Promise<BatchResultItem[]>;
  query<C extends keyof S & string>(
    collection: C,
    opts?: QueryOptions,
  ): Promise<InferDoc<S, C>[]>;
  count<C extends keyof S & string>(
    collection: C,
    opts?: Omit<QueryOptions, 'limit'>,
  ): Promise<number>;
  subscribe<C extends keyof S & string>(
    collection: C,
    listener: (event: ChangeEvent<InferDoc<S, C>>) => void,
    filter?: QueryFilter,
  ): () => void;
  syncNow(): Promise<SyncStatus>;
  getSyncStatus(): Promise<SyncStatus>;
  /** Worker mode, cross-tab transport, queue depth, last sync error. */
  getDiagnostics(): Promise<DatabaseDiagnostics>;
  /** Suspend automatic sync (debounce/backoff). `syncNow()` still runs. */
  pauseSync(): Promise<SyncStatus>;
  /** Resume automatic sync and schedule a near-immediate attempt when online. */
  resumeSync(): Promise<SyncStatus>;
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

export function resolveCrossTabFallback(
  workerMode: 'shared' | 'dedicated',
  option: CrossTabFallback = 'auto',
): 'none' | 'broadcast-channel' {
  if (option === 'none') return 'none';
  if (option === 'broadcast-channel') return 'broadcast-channel';
  return workerMode === 'dedicated' ? 'broadcast-channel' : 'none';
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
  const fallback = resolveCrossTabFallback(
    resolvedMode,
    options.crossTabFallback ?? 'auto',
  );
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
    if (fallback === 'broadcast-channel') {
      console.warn(
        '[worker-sync-db] SharedWorker unavailable — using dedicated worker with BroadcastChannel cross-tab relay. ' +
          'Set crossTabFallback: "none" to disable. Safari/WebViews still lack SharedWorker multi-tab semantics for sync leadership.',
      );
    } else {
      console.warn(
        '[worker-sync-db] SharedWorker unavailable — using dedicated worker; cross-tab live updates are disabled ' +
          '(crossTabFallback: "none"). Enable crossTabFallback: "broadcast-channel" or "auto" for BroadcastChannel relay.',
      );
    }
  }

  return createClientFromBridge(bridge, {
    dbName: options.dbName,
    workerMode: resolvedMode,
    crossTabFallback: fallback,
  });
}

function createClientFromBridge<S extends CollectionSchema>(
  bridge: PortBridge,
  meta: {
    dbName: string;
    workerMode: 'shared' | 'dedicated';
    crossTabFallback: 'none' | 'broadcast-channel';
  },
): DatabaseClient<S> {
  const localSubscriptions = new Map<
    string,
    Set<(event: ChangeEvent<InferDoc<S, string>>) => void>
  >();

  const deliverLocal = (payload: ChangeEventPayload) => {
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
  };

  const broadcaster =
    meta.crossTabFallback === 'broadcast-channel'
      ? createCrossTabBroadcaster(meta.dbName, deliverLocal)
      : null;

  const transport: CrossTabTransport =
    meta.workerMode === 'shared'
      ? 'shared-worker'
      : broadcaster
        ? 'broadcast-channel'
        : 'none';

  bridge.onEvent((event: WorkerEvent) => {
    if (event.kind !== 'change') return;
    const payload = event as ChangeEventPayload;
    deliverLocal(payload);
    broadcaster?.publish(payload);
  });

  return {
    getWorkerMode() {
      return meta.workerMode;
    },

    getCrossTabTransport() {
      return transport;
    },

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
        doc: doc as Record<string, unknown> & { id: string },
      }) as Promise<InferDoc<S, typeof collection>>;
    },

    async putMany(collection, docs) {
      return bridge.call({
        type: 'putMany',
        collection,
        docs,
      }) as Promise<InferDoc<S, typeof collection>[]>;
    },

    async delete(collection, id) {
      return bridge.call({
        type: 'delete',
        collection,
        id,
      }) as Promise<InferDoc<S, typeof collection>>;
    },

    async deleteMany(collection, ids) {
      return bridge.call({
        type: 'deleteMany',
        collection,
        ids,
      }) as Promise<InferDoc<S, typeof collection>[]>;
    },

    async clear(collection) {
      return bridge.call({
        type: 'clear',
        collection,
      }) as Promise<InferDoc<S, typeof collection>[]>;
    },

    async batch(ops) {
      return bridge.call({
        type: 'batch',
        ops,
      }) as Promise<BatchResultItem[]>;
    },

    async query(collection, opts = {}) {
      const { filter, orderBy, limit, ...idbOpts } = opts;
      const deferLimit = Boolean(filter || orderBy);
      const rows = (await bridge.call({
        type: 'query',
        collection,
        index: idbOpts.index,
        range: idbOpts.range,
        limit: deferLimit ? undefined : limit,
        includeDeleted: idbOpts.includeDeleted,
      })) as Array<InferDoc<S, typeof collection> & Record<string, unknown>>;

      if (!filter && !orderBy) {
        return rows as InferDoc<S, typeof collection>[];
      }
      return applyClientQueryOptions(rows, {
        filter,
        orderBy,
        limit,
      }) as InferDoc<S, typeof collection>[];
    },

    async count(collection, opts = {}) {
      return bridge.call({
        type: 'count',
        collection,
        index: opts.index,
        range: opts.range,
        includeDeleted: opts.includeDeleted,
      }) as Promise<number>;
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

    async getDiagnostics() {
      const status = await bridge.call({
        type: 'getSyncStatus',
      }) as SyncStatus;
      return {
        workerMode: meta.workerMode,
        crossTabTransport: transport,
        queueDepth: status.pending,
        pending: status.pending,
        lastSyncAt: status.lastSyncAt,
        lastError: status.lastError,
        nextSyncAt: status.nextSyncAt,
        online: status.online,
        paused: status.paused,
      } satisfies DatabaseDiagnostics;
    },

    async pauseSync() {
      return bridge.call({ type: 'pauseSync' }) as Promise<SyncStatus>;
    },

    async resumeSync() {
      return bridge.call({ type: 'resumeSync' }) as Promise<SyncStatus>;
    },

    onSyncStatusChange(listener) {
      return bridge.onEvent((event) => {
        if (event.kind === 'syncStatus') {
          listener(event.status);
        }
      });
    },

    close() {
      broadcaster?.close();
      void bridge.call({ type: 'disconnect' });
      bridge.close();
    },
  };
}
