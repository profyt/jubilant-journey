import type { DocumentMeta } from './meta.js';

export type CollectionSchema = Record<
  string,
  { keyPath: string; indexes?: Record<string, string> }
>;

export type InferDoc<
  S extends CollectionSchema,
  _C extends keyof S & string = keyof S & string,
> = Record<string, unknown> & DocumentMeta;

export interface IDBKeyRangeInit {
  lower?: IDBValidKey;
  upper?: IDBValidKey;
  lowerOpen?: boolean;
  upperOpen?: boolean;
}

export interface QueryOptions {
  index?: string;
  range?: IDBKeyRangeInit;
  limit?: number;
  includeDeleted?: boolean;
}

export function schemasEqual(
  a: CollectionSchema,
  b: CollectionSchema,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
