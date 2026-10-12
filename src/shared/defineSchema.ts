import type { CollectionDef, CollectionSchema } from './schema.js';

/**
 * Identity helper for schema definitions. Preserves `as const` literals for
 * typed collection names on `DatabaseClient`.
 *
 * Prefer `defineCollection<MyDoc>(…)` per store when you want typed `get`/`put`.
 *
 * @example
 * ```ts
 * const schema = defineSchema({
 *   todos: defineCollection<{ id: string; title: string; status: string }>({
 *     keyPath: 'id',
 *     indexes: { byStatus: 'status' },
 *   }),
 * });
 * ```
 */
export function defineSchema<S extends CollectionSchema>(schema: S): S {
  return schema;
}

/**
 * Declare a collection with a document TypeScript shape (type-only; no runtime cost).
 */
export function defineCollection<TDoc extends Record<string, unknown>>(def: {
  keyPath: Extract<keyof TDoc, string>;
  indexes?: Record<string, Extract<keyof TDoc, string>>;
}): CollectionDef<TDoc> {
  return def as CollectionDef<TDoc>;
}
