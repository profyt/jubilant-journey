import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { DatabaseClient } from '../client/createDatabase.js';
import type { CollectionSchema } from '../shared/schema.js';

/**
 * Context stores an opaque client handle. Narrow `DatabaseClient<S>` values are
 * not assignable to `DatabaseClient<CollectionSchema>` (contravariant collection
 * keys), so the provider boundary intentionally erases the schema type.
 */
export interface DatabaseContextValue {
  db: object | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export interface DatabaseProviderProps {
  db: object | null;
  children: ReactNode;
}

/**
 * Provides a `DatabaseClient` so hooks can omit the `db` argument.
 */
export function DatabaseProvider(props: DatabaseProviderProps) {
  const { db, children } = props;
  const value = useMemo(() => ({ db }), [db]);
  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabaseContext(): DatabaseContextValue | null {
  return useContext(DatabaseContext);
}

export function useDatabase<S extends CollectionSchema = CollectionSchema>(): DatabaseClient<S> | null {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error(
      'useDatabase must be used within <DatabaseProvider> (or pass db explicitly to hooks)',
    );
  }
  return ctx.db as DatabaseClient<S> | null;
}

/** Resolve explicit db or context db. */
export function resolveDatabase<S extends CollectionSchema>(
  explicit: DatabaseClient<S> | null | undefined,
  ctx: DatabaseContextValue | null,
): DatabaseClient<S> | null {
  if (explicit !== undefined) {
    return explicit;
  }
  if (!ctx) {
    throw new Error(
      'No database: pass `db` to the hook or wrap the tree in <DatabaseProvider db={...}>',
    );
  }
  return ctx.db as DatabaseClient<S> | null;
}
