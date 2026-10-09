export { createDatabase, isSharedWorkerSupported, resolveWorkerMode } from './client/createDatabase.js';
export { sharedWorkerUrl, dedicatedWorkerUrl } from './workerUrls.js';
export type {
  ChangeEvent,
  CreateDatabaseOptions,
  DatabaseClient,
  RemoteConfig,
  WorkerMode,
} from './client/createDatabase.js';

export { PortBridge } from './client/PortBridge.js';
export type {
  PortBridgeOptions,
  EventListener,
  OnConflictHandler,
} from './client/PortBridge.js';
export { connectSharedWorker } from './client/SharedWorkerBridge.js';
export { connectDedicatedWorker } from './client/DedicatedWorkerBridge.js';

export {
  toIDBKeyRange,
  type CollectionSchema,
  type InferDoc,
  type QueryOptions,
  type IDBKeyRangeInit,
} from './shared/schema.js';
export type { DocumentMeta } from './shared/meta.js';
export type {
  WorkerRequest,
  WorkerRequestInput,
  WorkerResponse,
  WorkerEvent,
  SyncConfig,
  ChangeEventPayload,
  ConnectResult,
  QueryFilter,
} from './shared/protocol.js';
export type { DbError, DbErrorCode } from './shared/errors.js';
export { DatabaseError, dbError } from './shared/errors.js';

export type {
  RemoteSyncAdapter,
  PendingOp,
  RemoteChange,
  SyncStatus,
  Conflict,
  FetchSyncConfig,
} from './sync/RemoteSyncAdapter.js';
