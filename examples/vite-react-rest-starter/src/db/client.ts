import {
  createDatabase,
  defineSchema,
  type DatabaseClient,
} from 'worker-sync-db';
import { dedicatedWorkerUrl, sharedWorkerUrl } from './workers.js';
import { STARTER_AUTH_TOKEN } from '../sync/auth.js';

export const schema = defineSchema({
  notes: {
    keyPath: 'id',
  },
});

export type StarterDb = DatabaseClient<typeof schema>;

/** Demo token — replace with your real auth header factory. */
export const AUTH_TOKEN = STARTER_AUTH_TOKEN;

export async function openStarterDb(): Promise<StarterDb> {
  return createDatabase({
    schema,
    dbName: 'wsd-rest-starter',
    sharedWorker: sharedWorkerUrl,
    dedicatedWorker: dedicatedWorkerUrl,
    remote: {
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
