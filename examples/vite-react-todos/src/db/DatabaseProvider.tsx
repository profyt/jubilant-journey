import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createDatabase, type DatabaseClient } from 'worker-sync-db';
import {
  DatabaseProvider as WsdProvider,
  useDatabase as useWsdDatabase,
  useSyncStatus,
} from 'worker-sync-db/react';
import { mockAdapter } from '../sync/mockAdapter.js';
import { schema } from './schema.js';
import { dedicatedWorkerUrl, sharedWorkerUrl } from './workers.js';

export type AppDatabase = DatabaseClient<typeof schema>;

const DB_NAME = 'vite-react-todos';
const BootErrorContext = createContext<string | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let client: AppDatabase | null = null;

    void (async () => {
      try {
        const opened = await createDatabase({
          schema,
          dbName: DB_NAME,
          mode: 'auto',
          sharedWorker: sharedWorkerUrl,
          dedicatedWorker: dedicatedWorkerUrl,
          remote: mockAdapter,
          onConflict: ({ opId, reason }) => {
            console.warn('[sync conflict]', opId, reason);
          },
        });

        if (disposed) {
          opened.close();
          return;
        }

        client = opened;
        setDb(opened);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      disposed = true;
      client?.close();
    };
  }, []);

  return (
    <WsdProvider db={db}>
      <BootErrorContext.Provider value={error}>{children}</BootErrorContext.Provider>
    </WsdProvider>
  );
}

export function useDatabase() {
  const db = useWsdDatabase<typeof schema>();
  const syncStatus = useSyncStatus();
  const error = useContext(BootErrorContext);
  return { db, error, syncStatus };
}
