import { DatabaseError } from '../shared/errors.js';
import type {
  PortMessage,
  SyncDelegateRequest,
  SyncDelegateResponse,
  WorkerEvent,
  WorkerRequest,
  WorkerRequestInput,
  WorkerResponse,
} from '../shared/protocol.js';
import { createRequestId, isWorkerEvent, isWorkerResponse } from '../shared/protocol.js';
import type { Conflict, RemoteSyncAdapter } from '../sync/RemoteSyncAdapter.js';

export type EventListener = (event: WorkerEvent) => void;

export type OnConflictHandler = (conflict: Conflict) => void;

export interface PortBridgeOptions {
  timeoutMs?: number;
  remote?: RemoteSyncAdapter;
  onConflict?: OnConflictHandler;
}

export class PortBridge {
  private readonly pending = new Map<
    string,
    {
      resolve: (data: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly eventListeners = new Set<EventListener>();
  private closed = false;
  private readonly timeoutMs: number;
  private readonly remote?: RemoteSyncAdapter;
  private readonly onConflict?: OnConflictHandler;

  constructor(
    private port: MessagePort,
    options: PortBridgeOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.remote = options.remote;
    this.onConflict = options.onConflict;
    this.port.start();
    this.port.onmessage = (event: MessageEvent<PortMessage>) => {
      void this.handleMessage(event.data);
    };
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async call<T = unknown>(
    request: WorkerRequestInput,
    signal?: AbortSignal,
  ): Promise<T> {
    if (this.closed) {
      throw new DatabaseError({ code: 'NotConnected', message: 'Port closed' });
    }

    const requestId = createRequestId();
    const fullRequest = { ...request, requestId } as WorkerRequest;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DatabaseError({ code: 'Timeout', message: 'Request timed out' }));
      }, this.timeoutMs);

      const onAbort = () => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(new DatabaseError({ code: 'InvalidRequest', message: 'Aborted' }));
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });

      this.pending.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });

      this.port.postMessage(fullRequest);
    });
  }

  close(): void {
    this.closed = true;
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(new DatabaseError({ code: 'NotConnected', message: 'Port closed' }));
    }
    this.pending.clear();
    this.eventListeners.clear();
  }

  private async handleMessage(data: PortMessage): Promise<void> {
    if (isWorkerResponse(data)) {
      this.handleResponse(data);
      return;
    }

    if (isWorkerEvent(data)) {
      if (data.kind === 'sync:pull' || data.kind === 'sync:push') {
        await this.handleSyncDelegate(data);
        return;
      }
      for (const listener of this.eventListeners) {
        listener(data);
      }
    }
  }

  private handleResponse(response: WorkerResponse): void {
    const waiter = this.pending.get(response.requestId);
    if (!waiter) return;

    clearTimeout(waiter.timer);
    this.pending.delete(response.requestId);

    if (!response.ok) {
      waiter.reject(new DatabaseError(response.error));
      return;
    }

    waiter.resolve(response.data);
  }

  private async handleSyncDelegate(
    request: SyncDelegateRequest,
  ): Promise<void> {
    if (!this.remote) {
      this.port.postMessage({
        kind: 'sync:pull:result',
        requestId: request.requestId,
        changes: [],
        nextCursor: null,
      } satisfies SyncDelegateResponse);
      return;
    }

    try {
      if (request.kind === 'sync:pull') {
        const result = await this.remote.pull(request.cursor);
        this.port.postMessage({
          kind: 'sync:pull:result',
          requestId: request.requestId,
          changes: result.changes,
          nextCursor: result.nextCursor,
        } satisfies SyncDelegateResponse);
      } else {
        const result = await this.remote.push(request.ops);
        for (const conflict of result.conflicts ?? []) {
          this.onConflict?.(conflict);
        }
        this.port.postMessage({
          kind: 'sync:push:result',
          requestId: request.requestId,
          applied: result.applied,
          conflicts: result.conflicts,
        } satisfies SyncDelegateResponse);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync delegate failed';
      if (request.kind === 'sync:pull') {
        this.port.postMessage({
          kind: 'sync:pull:result',
          requestId: request.requestId,
          changes: [],
          nextCursor: null,
        } satisfies SyncDelegateResponse);
      } else {
        this.port.postMessage({
          kind: 'sync:push:result',
          requestId: request.requestId,
          applied: [],
          conflicts: [{ opId: 'all', reason: message }],
        } satisfies SyncDelegateResponse);
      }
    }
  }
}
