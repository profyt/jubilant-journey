import { useEffect, useRef } from 'react';
import type { ChangeEvent, DatabaseClient } from '../client/createDatabase.js';
import type { QueryFilter } from '../shared/protocol.js';
import type { CollectionSchema, InferDoc } from '../shared/schema.js';
import { resolveDatabase, useDatabaseContext } from './DatabaseProvider.js';

export type SubscribeListener<T> = (event: ChangeEvent<T>) => void;

export function useSubscribe<S extends CollectionSchema, C extends keyof S & string>(
  db: DatabaseClient<S> | null | undefined,
  collection: C,
  listener: SubscribeListener<InferDoc<S, C>>,
  filter?: QueryFilter,
): void;
export function useSubscribe<S extends CollectionSchema, C extends keyof S & string>(
  collection: C,
  listener: SubscribeListener<InferDoc<S, C>>,
  filter?: QueryFilter,
): void;
/**
 * Subscribe to live change events. Listener may be inline (held in a ref).
 *
 * @example
 * ```tsx
 * useSubscribe(db, 'todos', (e) => console.log(e.type, e.id));
 * useSubscribe('todos', (e) => console.log(e)); // with DatabaseProvider
 * ```
 */
export function useSubscribe<S extends CollectionSchema, C extends keyof S & string>(
  dbOrCollection: DatabaseClient<S> | null | undefined | C,
  collectionOrListener: C | SubscribeListener<InferDoc<S, C>>,
  listenerOrFilter?: SubscribeListener<InferDoc<S, C>> | QueryFilter,
  maybeFilter?: QueryFilter,
): void {
  const ctx = useDatabaseContext();

  const withExplicitDb = typeof dbOrCollection !== 'string';
  const explicitDb = withExplicitDb
    ? (dbOrCollection as DatabaseClient<S> | null | undefined)
    : undefined;
  const collection = (
    withExplicitDb ? collectionOrListener : dbOrCollection
  ) as C;
  const listener = (
    withExplicitDb ? listenerOrFilter : collectionOrListener
  ) as SubscribeListener<InferDoc<S, C>>;
  const filter = (
    withExplicitDb ? maybeFilter : listenerOrFilter
  ) as QueryFilter | undefined;

  const db = resolveDatabase(explicitDb, ctx);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  const filterField = filter?.field;
  const filterValue = filter?.value;

  useEffect(() => {
    if (!db) return;

    const activeFilter =
      filterField !== undefined
        ? { field: filterField, value: filterValue }
        : undefined;

    return db.subscribe(
      collection,
      (event) => {
        listenerRef.current(event);
      },
      activeFilter,
    );
  }, [db, collection, filterField, filterValue]);
}
