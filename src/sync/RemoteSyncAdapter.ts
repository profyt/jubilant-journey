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
  /** When the next debounced / backoff sync will run (epoch ms), or null. */
  nextSyncAt: number | null;
  /** User pause — auto-sync (debounce/backoff) is suspended. `syncNow()` still runs. */
  paused: boolean;
}

export interface SyncSchedulerOptions {
  /** Debounce after mutations before auto-sync. Default 300. */
  debounceMs?: number;
  /** Initial backoff after a failed sync. Default 1000. */
  baseBackoffMs?: number;
  /** Cap for exponential backoff. Default 30000. */
  maxBackoffMs?: number;
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
