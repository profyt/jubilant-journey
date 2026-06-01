import { dbError } from '../shared/errors.js';
import type {
  SyncDelegateResponse,
  SyncConfig,
} from '../shared/protocol.js';
import type {
  FetchSyncConfig,
  PendingOp,
  RemoteChange,
  SyncStatus,
} from '../sync/RemoteSyncAdapter.js';
import type { ClientRegistry } from './ClientRegistry.js';
import type { DbEngine } from './DbEngine.js';

type PullResult = { changes: RemoteChange[]; nextCursor: string | null };
type PushResult = { applied: string[]; conflicts?: Array<{ opId: string; reason: string }> };

export class RemoteSync {
  private status: SyncStatus = {
    pending: 0,
    lastSyncAt: null,
    lastError: null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  private syncConfig: SyncConfig | null = null;
  private syncing = false;
  private onConflict?: (conflict: { opId: string; reason: string }) => void;
  private readonly delegateWaiters = new Map<
    string,
    {
      resolve: (value: SyncDelegateResponse) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    private readonly db: DbEngine,
    private readonly registry: ClientRegistry,
  ) {
    if (typeof self !== 'undefined' && 'addEventListener' in self) {
      self.addEventListener('online', () => {
        this.status.online = true;
        this.broadcastStatus();
        void this.syncNow();
      });
      self.addEventListener('offline', () => {
        this.status.online = false;
        this.broadcastStatus();
      });
    }
  }

  setConfig(config: SyncConfig | null): void {
    this.syncConfig = config;
  }

  setOnConflict(
    handler: ((conflict: { opId: string; reason: string }) => void) | undefined,
  ): void {
    this.onConflict = handler;
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  async refreshPendingCount(): Promise<void> {
    const pending = await this.db.getPendingOps();
    this.status.pending = pending.length;
    this.broadcastStatus();
  }

  broadcastStatus(): void {
    this.registry.broadcast({
      kind: 'syncStatus',
      status: this.getStatus(),
    });
  }

  handleDelegateResponse(msg: SyncDelegateResponse): void {
    const waiter = this.delegateWaiters.get(msg.requestId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.delegateWaiters.delete(msg.requestId);
    waiter.resolve(msg);
  }

  async syncNow(): Promise<SyncStatus> {
    if (this.syncing) {
      return this.getStatus();
    }
    if (!this.syncConfig) {
      await this.refreshPendingCount();
      return this.getStatus();
    }

    this.syncing = true;
    try {
      if (this.syncConfig.kind === 'fetch') {
        await this.syncWithFetch(this.syncConfig);
      } else {
        await this.syncWithDelegate();
      }
      this.status.lastSyncAt = Date.now();
      this.status.lastError = null;
    } catch (err) {
      this.status.lastError =
        err instanceof Error ? err.message : 'Sync failed';
    } finally {
      this.syncing = false;
      await this.refreshPendingCount();
    }
    return this.getStatus();
  }

  private async syncWithFetch(config: FetchSyncConfig): Promise<void> {
    const pending = await this.db.getPendingOps();
    if (pending.length > 0) {
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers,
      };
      const pushRes = await fetch(config.pushUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ops: pending }),
      });
      if (!pushRes.ok) {
        throw new Error(`Push failed: ${pushRes.status}`);
      }
      const pushBody = (await pushRes.json()) as PushResult;
      for (const conflict of pushBody.conflicts ?? []) {
        this.onConflict?.(conflict);
      }
      await this.db.removePendingOps(pushBody.applied);
    }

    const cursor = await this.db.getCursor();
    const pullUrl = cursor
      ? `${config.pullUrl}?cursor=${encodeURIComponent(cursor)}`
      : config.pullUrl;
    const pullRes = await fetch(pullUrl, { headers: config.headers });
    if (!pullRes.ok) {
      throw new Error(`Pull failed: ${pullRes.status}`);
    }
    const pullBody = (await pullRes.json()) as PullResult;
    for (const change of pullBody.changes) {
      await this.db.applyRemoteChange(change);
    }
    await this.db.setCursor(pullBody.nextCursor);
  }

  private async syncWithDelegate(): Promise<void> {
    const leader = this.registry.getSyncLeader();
    if (!leader) {
      return;
    }

    const pending = await this.db.getPendingOps();
    if (pending.length > 0) {
      const pushResult = await this.delegatePush(leader.clientId, pending);
      for (const conflict of pushResult.conflicts ?? []) {
        this.onConflict?.(conflict);
      }
      await this.db.removePendingOps(pushResult.applied);
    }

    const cursor = await this.db.getCursor();
    const pullResult = await this.delegatePull(leader.clientId, cursor);
    for (const change of pullResult.changes) {
      await this.db.applyRemoteChange(change);
    }
    await this.db.setCursor(pullResult.nextCursor);
  }

  private delegatePull(
    leaderClientId: string,
    cursor: string | null,
  ): Promise<PullResult> {
    const requestId = crypto.randomUUID();
    return this.sendDelegate<PullResult>(leaderClientId, {
      kind: 'sync:pull',
      requestId,
      cursor,
    }, (msg) => {
      if (msg.kind === 'sync:pull:result') {
        return { changes: msg.changes, nextCursor: msg.nextCursor };
      }
      throw new Error('Unexpected delegate response');
    });
  }

  private delegatePush(
    leaderClientId: string,
    ops: PendingOp[],
  ): Promise<PushResult> {
    const requestId = crypto.randomUUID();
    return this.sendDelegate<PushResult>(leaderClientId, {
      kind: 'sync:push',
      requestId,
      ops,
    }, (msg) => {
      if (msg.kind === 'sync:push:result') {
        return { applied: msg.applied, conflicts: msg.conflicts };
      }
      throw new Error('Unexpected delegate response');
    });
  }

  private sendDelegate<T>(
    leaderClientId: string,
    request: import('../shared/protocol.js').SyncDelegateRequest,
    parse: (msg: SyncDelegateResponse) => T,
  ): Promise<T> {
    const leader = this.registry.get(leaderClientId);
    if (!leader) {
      return Promise.reject(dbError('NotConnected', 'Sync leader disconnected'));
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.delegateWaiters.delete(request.requestId);
        reject(new Error('Sync delegate timeout'));
      }, 30_000);

      this.delegateWaiters.set(request.requestId, {
        resolve: (msg) => {
          try {
            resolve(parse(msg));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        reject,
        timer,
      });

      leader.port.postMessage(request);
    });
  }
}
