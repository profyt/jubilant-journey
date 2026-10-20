/**
 * Vite bundles these as real worker chunks (deps inlined).
 */
import sharedWorkerUrl from '../../../../src/shared-worker/entry.ts?sharedworker&url';
import dedicatedWorkerUrl from '../../../../src/dedicated-worker/entry.ts?worker&url';

export { sharedWorkerUrl, dedicatedWorkerUrl };
