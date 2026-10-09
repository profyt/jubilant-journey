import type { CollectionSchema } from './schema.js';

/**
 * Identity helper for schema definitions. Preserves `as const` literals for
 * typed collection names on `DatabaseClient`.
 *
 * @example
 * ```ts
 * const schema = defineSchema({
 *   todos: { keyPath: 'id', indexes: { byStatus: 'status' } },
 * });
 * ```
 */
export function defineSchema<S extends CollectionSchema>(schema: S): S {
  return schema;
}
