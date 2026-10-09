import { useCallback, useEffect, useRef, useState } from 'react';
import type { DatabaseClient } from '../client/createDatabase.js';
import type { CollectionSchema, InferDoc, QueryOptions } from '../shared/schema.js';
import { resolveDatabase, useDatabaseContext } from './DatabaseProvider.js';

export interface UseQueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  /** Re-run the query against IndexedDB. */
  refetch: () => Promise<void>;
}

export interface UseQueryOptions extends QueryOptions {
  /** When false, skip fetching/subscribing. Default true. */
  enabled?: boolean;
}

export function useQuery<S extends CollectionSchema, C extends keyof S & string>(
  db: DatabaseClient<S> | null | undefined,
  collection: C,
  options?: UseQueryOptions,
): UseQueryResult<InferDoc<S, C>>;
export function useQuery<S extends CollectionSchema, C extends keyof S & string>(
  collection: C,
  options?: UseQueryOptions,
): UseQueryResult<InferDoc<S, C>>;
/**
 * Live query: `db.query` + refresh on collection `subscribe` events.
 *
 * @example
 * ```tsx
 * const { data, loading } = useQuery(db, 'todos', { index: 'byStatus' });
 * // with DatabaseProvider:
 * const { data } = useQuery('todos');
 * ```
 */
export function useQuery<S extends CollectionSchema, C extends keyof S & string>(
  dbOrCollection: DatabaseClient<S> | null | undefined | C,
  collectionOrOptions?: C | UseQueryOptions,
  maybeOptions?: UseQueryOptions,
): UseQueryResult<InferDoc<S, C>> {
  const ctx = useDatabaseContext();

  const explicitDb =
    typeof dbOrCollection === 'string' ? undefined : (dbOrCollection as DatabaseClient<S> | null | undefined);
  const collection = (
    typeof dbOrCollection === 'string' ? dbOrCollection : collectionOrOptions
  ) as C;
  const options: UseQueryOptions =
    typeof dbOrCollection === 'string'
      ? ((collectionOrOptions as UseQueryOptions | undefined) ?? {})
      : (maybeOptions ?? {});

  const db = resolveDatabase(explicitDb, ctx);
  const enabled = options.enabled !== false;

  const [data, setData] = useState<InferDoc<S, C>[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled && db));
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refetch = useCallback(async () => {
    if (!db || !enabled) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      const { enabled: _enabled, ...queryOpts } = optionsRef.current;
      void _enabled;
      const rows = await db.query(collection, queryOpts);
      setData(rows as InferDoc<S, C>[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [db, collection, enabled]);

  useEffect(() => {
    if (!db || !enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void refetch();

    const unsub = db.subscribe(collection, () => {
      void refetch();
    });

    return unsub;
  }, [db, collection, enabled, refetch]);

  return { data, loading, error, refetch };
}
