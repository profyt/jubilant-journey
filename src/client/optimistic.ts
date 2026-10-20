import type { DatabaseClient } from './createDatabase.js';
import type { CollectionSchema, DocInput, InferDoc } from '../shared/schema.js';

/**
 * Client-side temporary document id (`tmp_<uuid>` by default).
 * Useful for optimistic creates before a server assigns a stable id.
 * Not a CRDT replica id — swap or keep as your API requires.
 */
export function createTempId(prefix = 'tmp'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** True when `id` was produced by {@link createTempId} with the same prefix. */
export function isTempId(id: string, prefix = 'tmp'): boolean {
  return id.startsWith(`${prefix}_`);
}

/**
 * Write locally first, then run `action`. On failure, soft-delete the local
 * doc (best-effort) and rethrow. Does not change remote LWW / sync-queue
 * semantics — use for UI rollback around your own network call.
 *
 * @example
 * ```ts
 * const id = createTempId();
 * await withOptimisticPut(db, 'todos', { id, title: 'Buy milk' }, async () => {
 *   await fetch('/api/todos', { method: 'POST', body: JSON.stringify({ id, title: 'Buy milk' }) });
 * });
 * ```
 */
export async function withOptimisticPut<
  S extends CollectionSchema,
  C extends keyof S & string,
>(
  db: DatabaseClient<S>,
  collection: C,
  doc: DocInput<S, C>,
  action: (saved: InferDoc<S, C>) => Promise<void>,
): Promise<InferDoc<S, C>> {
  const saved = await db.put(collection, doc);
  try {
    await action(saved);
    return saved;
  } catch (err) {
    try {
      await db.delete(collection, saved.id);
    } catch {
      // best-effort rollback
    }
    throw err;
  }
}
