import type { QueryFilter } from '../shared/protocol.js';
import type { ChangeEventPayload, WorkerEvent } from '../shared/protocol.js';

export interface ClientSubscription {
  collection: string;
  filter?: QueryFilter;
}

export interface RegisteredClient {
  clientId: string;
  port: MessagePort;
  subscriptions: Map<string, ClientSubscription>;
  syncCapable: boolean;
}

export class ClientRegistry {
  private clients = new Map<string, RegisteredClient>();
  private syncLeaderId: string | null = null;

  register(
    port: MessagePort,
    options: { syncCapable?: boolean } = {},
  ): string {
    const clientId = crypto.randomUUID();
    const client: RegisteredClient = {
      clientId,
      port,
      subscriptions: new Map(),
      syncCapable: options.syncCapable ?? false,
    };
    this.clients.set(clientId, client);

    if (options.syncCapable && !this.syncLeaderId) {
      this.syncLeaderId = clientId;
    }

    return clientId;
  }

  unregister(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    if (this.syncLeaderId === clientId) {
      this.syncLeaderId = this.findNextSyncLeader();
    }
  }

  get(clientId: string): RegisteredClient | undefined {
    return this.clients.get(clientId);
  }

  getSyncLeader(): RegisteredClient | undefined {
    if (this.syncLeaderId) {
      return this.clients.get(this.syncLeaderId);
    }
    return undefined;
  }

  claimSyncLeader(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client?.syncCapable) return false;
    this.syncLeaderId = clientId;
    return true;
  }

  subscribe(
    clientId: string,
    collection: string,
    filter?: QueryFilter,
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.subscriptions.set(collection, { collection, filter });
  }

  unsubscribe(clientId: string, collection: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    client.subscriptions.delete(collection);
  }

  broadcastChange(event: Omit<ChangeEventPayload, 'kind'>): void {
    this.broadcast({
      kind: 'change',
      ...event,
    });
  }

  broadcast(event: WorkerEvent): void {
    if (event.kind === 'change') {
      for (const client of this.clients.values()) {
        const sub = client.subscriptions.get(event.collection);
        if (!sub) continue;
        if (sub.filter && !matchesFilter(event, sub.filter)) continue;
        client.port.postMessage(event);
      }
      return;
    }

    for (const client of this.clients.values()) {
      client.port.postMessage(event);
    }
  }

  sendToClient(clientId: string, event: WorkerEvent): void {
    const client = this.clients.get(clientId);
    client?.port.postMessage(event);
  }

  sendToSyncLeader(event: WorkerEvent): void {
    const leader = this.getSyncLeader();
    leader?.port.postMessage(event);
  }

  private findNextSyncLeader(): string | null {
    for (const [id, client] of this.clients) {
      if (client.syncCapable) return id;
    }
    return null;
  }
}

function matchesFilter(
  event: ChangeEventPayload,
  filter: QueryFilter,
): boolean {
  if (event.type === 'delete' || !event.doc) return false;
  return event.doc[filter.field] === filter.value;
}
