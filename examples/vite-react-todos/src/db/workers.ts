/** Explicit Vite `?url` assets so SharedWorker chunks ship on Pages + local. */
import sharedWorkerUrl from '../../../../dist/shared-worker/entry.js?url';
import dedicatedWorkerUrl from '../../../../dist/dedicated-worker/entry.js?url';

export { sharedWorkerUrl, dedicatedWorkerUrl };
