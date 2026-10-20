export { createDatabase, isSharedWorkerSupported, resolveWorkerMode } from './client/createDatabase.js';
export { sharedWorkerUrl, dedicatedWorkerUrl } from './workerUrls.js';
export type {
  ChangeEvent,
  CreateDatabaseOptions,
  CrossTabFallback,
  CrossTabTransport,
  DatabaseClient,
  RemoteConfig,
  WorkerMode,
} from './client/createDatabase.js';
export { resolveCrossTabFallback } from './client/createDatabase.js';

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
  describeSchemaChange,
  computeSchemaVersion,
  schemasEqual,
  type CollectionSchema,
  type CollectionDef,
  type InferDoc,
  type DocInput,
  type QueryOptions,
  type QueryOrderBy,
  type IDBKeyRangeInit,
  type SchemaChangeKind,
  type SchemaChangeResult,
} from './shared/schema.js';
export { defineSchema, defineCollection } from './shared/defineSchema.js';
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
  BatchOp,
  BatchResultItem,
} from './shared/protocol.js';
export type { DbError, DbErrorCode } from './shared/errors.js';
export { DatabaseError, dbError } from './shared/errors.js';

export type {
  RemoteSyncAdapter,
  PendingOp,
  RemoteChange,
  SyncStatus,
  SyncSchedulerOptions,
  Conflict,
  FetchSyncConfig,
} from './sync/RemoteSyncAdapter.js';
