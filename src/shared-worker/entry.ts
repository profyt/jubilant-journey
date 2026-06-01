import { ClientRegistry } from './ClientRegistry.js';
import { DbEngine } from './DbEngine.js';
import { MessageRouter } from './MessageRouter.js';
import { RemoteSync } from './RemoteSync.js';

declare const self: SharedWorkerGlobalScope;

const db = new DbEngine();
const registry = new ClientRegistry();
const remoteSync = new RemoteSync(db, registry);
const router = new MessageRouter(db, registry, remoteSync);

self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  if (!port) return;
  router.attach(port);
};
