import { dbError } from '../shared/errors.js';
import type {
  ConnectResult,
  PortMessage,
  SyncDelegateResponse,
  WorkerRequest,
  WorkerResponse,
} from '../shared/protocol.js';
import { isWorkerRequest, isWorkerResponse } from '../shared/protocol.js';
import { schemasEqual } from '../shared/schema.js';
import type { ClientRegistry } from './ClientRegistry.js';
import type { DbEngine } from './DbEngine.js';
import type { RemoteSync } from './RemoteSync.js';

export class MessageRouter {
  private initialized = false;
  private dbName: string | null = null;

  constructor(
    private readonly db: DbEngine,
    private readonly registry: ClientRegistry,
    private readonly remoteSync: RemoteSync,
  ) {}

  attach(port: MessagePort): void {
    port.start();
    const clientId = this.registry.register(port, { syncCapable: false });

    port.onmessage = (event: MessageEvent<PortMessage>) => {
      void this.handleMessage(clientId, port, event.data);
    };
  }

  private async handleMessage(
    clientId: string,
    port: MessagePort,
    data: PortMessage,
  ): Promise<void> {
    if (isWorkerResponse(data)) {
      return;
    }

    if (
      data &&
      typeof data === 'object' &&
      'kind' in data &&
      (data.kind === 'sync:pull:result' || data.kind === 'sync:push:result')
    ) {
      this.remoteSync.handleDelegateResponse(data as SyncDelegateResponse);
      return;
    }

    if (!isWorkerRequest(data)) {
      return;
    }

    const request = data as WorkerRequest;
    try {
      const response = await this.dispatch(clientId, request);
      port.postMessage(response satisfies WorkerResponse);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' &&
              err !== null &&
              'message' in err
            ? String((err as { message: string }).message)
            : 'Unknown error';
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err
          ? (err as { code: import('../shared/errors.js').DbErrorCode }).code
          : 'StorageError';
      port.postMessage({
        kind: 'response',
        requestId: request.requestId,
        ok: false,
        error: dbError(code, message),
      } satisfies WorkerResponse);
    }
  }

  private async dispatch(
    clientId: string,
    request: WorkerRequest,
  ): Promise<WorkerResponse> {
    const { requestId } = request;

    switch (request.type) {
      case 'connect': {
        if (this.initialized && this.dbName !== request.dbName) {
          return this.fail(requestId, 'SchemaMismatch', 'Database name mismatch');
        }

        const existingSchema = this.db.getSchema();
        if (
          existingSchema &&
          !schemasEqual(existingSchema, request.schema)
        ) {
          return this.fail(
            requestId,
            'SchemaMismatch',
            'Schema does not match existing database',
          );
        }

        await this.db.init(request.dbName, request.schema);
        this.dbName = request.dbName;
        this.initialized = true;

        const client = this.registry.get(clientId);
        if (client && request.syncCapable) {
          client.syncCapable = true;
          if (!this.registry.getSyncLeader()) {
            this.registry.claimSyncLeader(clientId);
          }
        }

        if (request.sync) {
          this.remoteSync.setConfig(request.sync);
        }

        await this.remoteSync.refreshPendingCount();

        const result: ConnectResult = {
          clientId,
          isSyncLeader: this.registry.getSyncLeader()?.clientId === clientId,
        };

        return {
          kind: 'response',
          requestId,
          ok: true,
          data: result,
        };
      }

      case 'disconnect': {
        this.registry.unregister(clientId);
        return { kind: 'response', requestId, ok: true, data: null };
      }

      case 'get': {
        const doc = await this.db.get(request.collection, request.id);
        return { kind: 'response', requestId, ok: true, data: doc };
      }

      case 'query': {
        const docs = await this.db.query({
          collection: request.collection,
          index: request.index,
          range: request.range,
          limit: request.limit,
          includeDeleted: request.includeDeleted,
        });
        return { kind: 'response', requestId, ok: true, data: docs };
      }

      case 'put': {
        const { doc } = await this.db.put(request.collection, request.doc);
        await this.remoteSync.refreshPendingCount();
        this.registry.broadcastChange({
          collection: request.collection,
          type: 'put',
          doc,
          id: doc.id,
        });
        void this.remoteSync.syncNow();
        return { kind: 'response', requestId, ok: true, data: doc };
      }

      case 'delete': {
        const result = await this.db.delete(request.collection, request.id);
        if (!result) {
          return this.fail(requestId, 'NotFound', 'Document not found');
        }
        await this.remoteSync.refreshPendingCount();
        this.registry.broadcastChange({
          collection: request.collection,
          type: 'delete',
          doc: null,
          id: request.id,
        });
        void this.remoteSync.syncNow();
        return { kind: 'response', requestId, ok: true, data: result.doc };
      }

      case 'subscribe': {
        this.registry.subscribe(clientId, request.collection, request.filter);
        return { kind: 'response', requestId, ok: true, data: null };
      }

      case 'unsubscribe': {
        this.registry.unsubscribe(clientId, request.collection);
        return { kind: 'response', requestId, ok: true, data: null };
      }

      case 'syncNow': {
        const status = await this.remoteSync.syncNow();
        return { kind: 'response', requestId, ok: true, data: status };
      }

      case 'getSyncStatus': {
        return {
          kind: 'response',
          requestId,
          ok: true,
          data: this.remoteSync.getStatus(),
        };
      }

      default: {
        return this.fail(requestId, 'InvalidRequest', 'Unknown request type');
      }
    }
  }

  private fail(
    requestId: string,
    code: import('../shared/errors.js').DbErrorCode,
    message: string,
  ): WorkerResponse {
    return {
      kind: 'response',
      requestId,
      ok: false,
      error: dbError(code, message),
    };
  }
}
