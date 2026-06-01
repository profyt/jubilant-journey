import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createDatabase,
  type DatabaseClient,
  type SyncStatus,
} from 'worker-sync-db';
import { mockAdapter } from '../sync/mockAdapter.js';
import { schema } from './schema.js';

type AppDatabase = DatabaseClient<typeof schema>;

interface DatabaseContextValue {
  db: AppDatabase | null;
  error: string | null;
  syncStatus: SyncStatus | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  error: null,
  syncStatus: null,
});

const DB_NAME = 'vite-react-todos';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let disposed = false;
    let client: AppDatabase | null = null;
    let unsubStatus: (() => void) | undefined;

    void (async () => {
      try {
        const opened = await createDatabase({
          schema,
          dbName: DB_NAME,
          mode: 'auto',
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
        unsubStatus = opened.onSyncStatusChange(setSyncStatus);
        const status = await opened.getSyncStatus();
        if (disposed) {
          opened.close();
          return;
        }
        setSyncStatus(status);
        setDb(opened);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      disposed = true;
      unsubStatus?.();
      client?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ db, error, syncStatus }),
    [db, error, syncStatus],
  );

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
