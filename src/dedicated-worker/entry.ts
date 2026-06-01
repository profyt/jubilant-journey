import { ClientRegistry } from '../shared-worker/ClientRegistry.js';
import { DbEngine } from '../shared-worker/DbEngine.js';
import { MessageRouter } from '../shared-worker/MessageRouter.js';
import { RemoteSync } from '../shared-worker/RemoteSync.js';

declare const self: DedicatedWorkerGlobalScope;

const db = new DbEngine();
const registry = new ClientRegistry();
const remoteSync = new RemoteSync(db, registry);
const router = new MessageRouter(db, registry, remoteSync);

const channel = new MessageChannel();
self.postMessage({ type: 'port' }, [channel.port2]);
router.attach(channel.port1);
