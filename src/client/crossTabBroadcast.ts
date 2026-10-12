import type { ChangeEventPayload } from '../shared/protocol.js';
import type { DocumentMeta } from '../shared/meta.js';

export type CrossTabChangeMessage = {
  v: 1;
  sourceId: string;
  collection: string;
  type: 'put' | 'delete';
  id: string;
  doc: (DocumentMeta & Record<string, unknown>) | null;
};

export function crossTabChannelName(dbName: string): string {
  return `worker-sync-db:${dbName}:changes`;
}

export function createCrossTabBroadcaster(
  dbName: string,
  onRemoteChange: (payload: ChangeEventPayload) => void,
): {
  sourceId: string;
  publish: (payload: ChangeEventPayload) => void;
  close: () => void;
} | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const channel = new BroadcastChannel(crossTabChannelName(dbName));

  channel.onmessage = (event: MessageEvent<CrossTabChangeMessage>) => {
    const msg = event.data;
    if (!msg || msg.v !== 1 || msg.sourceId === sourceId) return;
    onRemoteChange({
      kind: 'change',
      collection: msg.collection,
      type: msg.type,
      id: msg.id,
      doc: msg.doc,
    });
  };

  return {
    sourceId,
    publish(payload) {
      const msg: CrossTabChangeMessage = {
        v: 1,
        sourceId,
        collection: payload.collection,
        type: payload.type,
        id: payload.id,
        doc: payload.doc,
      };
      channel.postMessage(msg);
    },
    close() {
      channel.close();
    },
  };
}
