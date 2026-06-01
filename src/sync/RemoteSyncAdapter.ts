import type { DocumentMeta } from '../shared/meta.js';

export interface PendingOp {
  opId: string;
  collection: string;
  doc: DocumentMeta & Record<string, unknown>;
  kind: 'put' | 'delete';
}

export interface RemoteChange {
  collection: string;
  doc: DocumentMeta & Record<string, unknown>;
  kind: 'put' | 'delete';
}

export interface Conflict {
  opId: string;
  reason: string;
}

export interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
  online: boolean;
}

export interface RemoteSyncAdapter {
  pull(cursor: string | null): Promise<{
    changes: RemoteChange[];
    nextCursor: string | null;
  }>;
  push(ops: PendingOp[]): Promise<{
    applied: string[];
    conflicts?: Conflict[];
  }>;
}

export interface FetchSyncConfig {
  pullUrl: string;
  pushUrl: string;
  headers?: Record<string, string>;
}
