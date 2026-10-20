import type { DocumentMeta } from './meta.js';

/**
 * Collection store definition. Pass a document shape via `defineCollection<TDoc>(…)`
 * so `InferDoc` can recover field types. Plain `{ keyPath, indexes }` stays
 * `Record<string, unknown> & DocumentMeta` (backwards compatible).
 */
export type CollectionDef<
  TDoc extends Record<string, unknown> = Record<string, unknown>,
> = {
  keyPath: string;
  indexes?: Record<string, string>;
  /** Type-only phantom — never set at runtime. */
  readonly __doc?: TDoc;
};

export type CollectionSchema = Record<string, CollectionDef>;

/**
 * Document type for collection `C` in schema `S`, including soft-delete meta.
 * When the collection was declared with `defineCollection<MyDoc>(…)`, fields of
 * `MyDoc` are preserved; otherwise falls back to `Record<string, unknown>`.
 */
export type InferDoc<
  S extends CollectionSchema,
  C extends keyof S & string = keyof S & string,
> = DocumentMeta &
  (S[C] extends CollectionDef<infer D>
    ? Record<string, unknown> extends D
      ? Record<string, unknown>
      : D
    : Record<string, unknown>);

/** Input to `put` — user fields + required `id`; meta fields optional/ignored. */
export type DocInput<
  S extends CollectionSchema,
  C extends keyof S & string,
> = Omit<InferDoc<S, C>, '_version' | '_updatedAt' | '_deleted'> & {
  id: string;
};

export interface IDBKeyRangeInit {
  lower?: IDBValidKey;
  upper?: IDBValidKey;
  lowerOpen?: boolean;
  upperOpen?: boolean;
}

export interface QueryOrderBy {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface QueryOptions {
  index?: string;
  range?: IDBKeyRangeInit;
  limit?: number;
  includeDeleted?: boolean;
  /**
   * Client-side predicate after the IndexedDB query (not sent to the worker).
   * When set with `limit`, the limit is applied after filtering/sorting.
   */
  filter?: (doc: Record<string, unknown>) => boolean;
  /**
   * Client-side sort after the IndexedDB query (not sent to the worker).
   */
  orderBy?: QueryOrderBy;
}

/** Build an IDBKeyRange from a serializable init (supports only / bound / lower / upper). */
export function toIDBKeyRange(range?: IDBKeyRangeInit): IDBKeyRange | undefined {
  if (!range) return undefined;
  const hasLower = range.lower !== undefined;
  const hasUpper = range.upper !== undefined;
  if (hasLower && hasUpper) {
    if (
      Object.is(range.lower, range.upper) &&
      !range.lowerOpen &&
      !range.upperOpen
    ) {
      return IDBKeyRange.only(range.lower as IDBValidKey);
    }
    return IDBKeyRange.bound(
      range.lower as IDBValidKey,
      range.upper as IDBValidKey,
      range.lowerOpen,
      range.upperOpen,
    );
  }
  if (hasLower) {
    return IDBKeyRange.lowerBound(range.lower as IDBValidKey, range.lowerOpen);
  }
  if (hasUpper) {
    return IDBKeyRange.upperBound(range.upper as IDBValidKey, range.upperOpen);
  }
  return undefined;
}

export function schemasEqual(
  a: CollectionSchema,
  b: CollectionSchema,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type SchemaChangeKind = 'identical' | 'compatible' | 'incompatible';

export interface SchemaChangeResult {
  kind: SchemaChangeKind;
  /** Human-readable reason when incompatible (or summary when compatible). */
  detail: string;
}

/**
 * Decide whether opening `next` against an existing DB with `previous` is safe.
 * Compatible: add collections, add indexes (same keyPath), remove collections.
 * Incompatible: change collection keyPath, change existing index keyPath.
 */
export function describeSchemaChange(
  previous: CollectionSchema,
  next: CollectionSchema,
): SchemaChangeResult {
  if (schemasEqual(previous, next)) {
    return { kind: 'identical', detail: 'Schemas are identical' };
  }

  for (const [name, prevDef] of Object.entries(previous)) {
    const nextDef = next[name];
    if (!nextDef) {
      continue; // collection removed — allowed (upgrade deletes store)
    }
    if (prevDef.keyPath !== nextDef.keyPath) {
      return {
        kind: 'incompatible',
        detail: `Collection "${name}" keyPath changed from "${prevDef.keyPath}" to "${nextDef.keyPath}"`,
      };
    }
    for (const [indexName, prevPath] of Object.entries(prevDef.indexes ?? {})) {
      const nextPath = nextDef.indexes?.[indexName];
      if (nextPath !== undefined && nextPath !== prevPath) {
        return {
          kind: 'incompatible',
          detail: `Index "${name}.${indexName}" keyPath changed from "${prevPath}" to "${nextPath}"`,
        };
      }
      // Dropping an index is ignored by IDB upgrade (index may linger); still compatible.
    }
  }

  return {
    kind: 'compatible',
    detail: 'Additive or removable schema change (new stores/indexes or dropped stores)',
  };
}

export function computeSchemaVersion(schema: CollectionSchema): number {
  const stores = Object.entries(schema).sort(([a], [b]) => a.localeCompare(b));
  let version = 1;
  for (const [name, def] of stores) {
    version = (version * 31 + hashString(name)) | 0;
    version = (version * 31 + hashString(def.keyPath)) | 0;
    const indexes = Object.entries(def.indexes ?? {}).sort(([x], [y]) =>
      x.localeCompare(y),
    );
    for (const [indexName, keyPath] of indexes) {
      version = (version * 31 + hashString(indexName)) | 0;
      version = (version * 31 + hashString(keyPath)) | 0;
    }
  }
  return Math.max(1, Math.abs(version));
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}
