import type { DbError } from './errors.js';
import type { DocumentMeta } from './meta.js';
import type { CollectionSchema, IDBKeyRangeInit } from './schema.js';
import type { PendingOp, RemoteChange, SyncStatus } from '../sync/RemoteSyncAdapter.js';

export type QueryFilter = {
  field: string;
  value: unknown;
};

export type SyncConfig =
  | { kind: 'delegate' }
  | {
      kind: 'fetch';
      pullUrl: string;
      pushUrl: string;
      headers?: Record<string, string>;
    };

export type WorkerRequest = {
  requestId: string;
} & (
  | {
      type: 'connect';
      dbName: string;
      schema: CollectionSchema;
      syncCapable?: boolean;
      sync?: SyncConfig;
    }
  | { type: 'disconnect' }
  | { type: 'get'; collection: string; id: string }
  | {
      type: 'query';
      collection: string;
      index?: string;
      range?: IDBKeyRangeInit;
      limit?: number;
      includeDeleted?: boolean;
    }
  | { type: 'put'; collection: string; doc: Record<string, unknown> & { id: string } }
  | { type: 'delete'; collection: string; id: string }
  | { type: 'subscribe'; collection: string; filter?: QueryFilter }
  | { type: 'unsubscribe'; collection: string }
  | { type: 'syncNow' }
  | { type: 'getSyncStatus' }
);

export type WorkerResponse =
  | { kind: 'response'; requestId: string; ok: true; data: unknown }
  | { kind: 'response'; requestId: string; ok: false; error: DbError };

export type ConnectResult = {
  clientId: string;
  isSyncLeader: boolean;
};

export type ChangeEventPayload = {
  kind: 'change';
  collection: string;
  type: 'put' | 'delete';
  doc: (DocumentMeta & Record<string, unknown>) | null;
  id: string;
};

export type SyncStatusEventPayload = {
  kind: 'syncStatus';
  status: SyncStatus;
};

export type SyncDelegateRequest =
  | { kind: 'sync:pull'; requestId: string; cursor: string | null }
  | { kind: 'sync:push'; requestId: string; ops: PendingOp[] };

export type SyncDelegateResponse =
  | {
      kind: 'sync:pull:result';
      requestId: string;
      changes: RemoteChange[];
      nextCursor: string | null;
    }
  | {
      kind: 'sync:push:result';
      requestId: string;
      applied: string[];
      conflicts?: Array<{ opId: string; reason: string }>;
    };

export type WorkerEvent =
  | ChangeEventPayload
  | SyncStatusEventPayload
  | SyncDelegateRequest;

export type PortMessage = WorkerRequest | WorkerResponse | WorkerEvent | SyncDelegateResponse;

export function isWorkerRequest(msg: PortMessage): msg is WorkerRequest {
  return 'requestId' in msg && 'type' in msg;
}

export function isWorkerResponse(msg: PortMessage): msg is WorkerResponse {
  return 'kind' in msg && (msg as WorkerResponse).kind === 'response';
}

export function isWorkerEvent(msg: PortMessage): msg is WorkerEvent {
  if (!('kind' in msg)) return false;
  const kind = (msg as { kind: string }).kind;
  return (
    kind !== 'response' &&
    kind !== 'sync:pull:result' &&
    kind !== 'sync:push:result'
  );
}

export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type WorkerRequestInput = {
  [T in WorkerRequest['type']]: Omit<
    Extract<WorkerRequest, { type: T }>,
    'requestId'
  >;
}[WorkerRequest['type']];
