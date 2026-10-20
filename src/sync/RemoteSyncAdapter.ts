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

/**
 * Inspect-only conflict / LWW notification. Default strategy remains
 * last-write-wins — this hook does **not** change merge behaviour.
 * To “resolve”, the app can `put` again after inspecting.
 */
export type Conflict =
  | {
      /** Server rejected or reported a push op conflict. */
      kind: 'push';
      opId: string;
      reason: string;
    }
  | {
      /**
       * Pull applied LWW against an existing local doc.
       * - `local-wins`: remote discarded (local newer / tie on version)
       * - `remote-applied`: remote overwrote local
       */
      kind: 'lww';
      collection: string;
      id: string;
      outcome: 'local-wins' | 'remote-applied';
      local: DocumentMeta & Record<string, unknown>;
      remote: DocumentMeta & Record<string, unknown>;
      reason: string;
    };

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
    /** Server-reported push conflicts (`onConflict` adds `kind: 'push'`). */
    conflicts?: Array<{ opId: string; reason: string }>;
  }>;
}

export interface FetchSyncConfig {
  pullUrl: string;
  pushUrl: string;
  headers?: Record<string, string>;
}
