import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Conflict } from 'worker-sync-db';

export type ConflictLogEntry = {
  id: string;
  at: number;
  conflict: Conflict;
};

type ConflictLogApi = {
  entries: ConflictLogEntry[];
  record: (conflict: Conflict) => void;
  clear: () => void;
};

const ConflictLogContext = createContext<ConflictLogApi | null>(null);

export function ConflictLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ConflictLogEntry[]>([]);

  const record = useCallback((conflict: Conflict) => {
    setEntries((prev) =>
      [
        {
          id: crypto.randomUUID(),
          at: Date.now(),
          conflict,
        },
        ...prev,
      ].slice(0, 24),
    );
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo(
    () => ({ entries, record, clear }),
    [entries, record, clear],
  );

  return (
    <ConflictLogContext.Provider value={value}>
      {children}
    </ConflictLogContext.Provider>
  );
}

export function useConflictLog(): ConflictLogApi {
  const ctx = useContext(ConflictLogContext);
  if (!ctx) {
    throw new Error('useConflictLog must be used within ConflictLogProvider');
  }
  return ctx;
}
