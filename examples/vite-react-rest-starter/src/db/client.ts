import {
  createDatabase,
  defineSchema,
  type DatabaseClient,
} from 'worker-sync-db';
import { dedicatedWorkerUrl, sharedWorkerUrl } from './workers.js';
import { STARTER_AUTH_TOKEN } from '../sync/auth.js';
import { createStaticMockAdapter } from '../sync/staticMockAdapter.js';

export const schema = defineSchema({
  notes: {
    keyPath: 'id',
  },
});

export type StarterDb = DatabaseClient<typeof schema>;

/** Demo token — replace with your real auth header factory. */
export const AUTH_TOKEN = STARTER_AUTH_TOKEN;

/** Set by Pages CI — static hosting has no Vite `/api/sync` middleware. */
export const usesStaticMock =
  import.meta.env.VITE_STATIC_MOCK === '1' ||
  import.meta.env.VITE_STATIC_MOCK === 'true';

export async function openStarterDb(): Promise<StarterDb> {
  return createDatabase({
    schema,
    dbName: 'wsd-rest-starter',
    sharedWorker: sharedWorkerUrl,
    dedicatedWorker: dedicatedWorkerUrl,
    remote: usesStaticMock
      ? createStaticMockAdapter()
      : {
          pullUrl: '/api/sync/pull',
          pushUrl: '/api/sync/push',
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
        },
    onConflict: (conflict) => {
      console.warn('[starter] conflict', conflict);
    },
  });
}
