import { openDB, type IDBPDatabase } from 'idb';
import { dbError } from '../shared/errors.js';
import type { DocumentMeta } from '../shared/meta.js';
import { withMeta, withSoftDelete } from '../shared/meta.js';
import {
  computeSchemaVersion,
  schemasEqual,
  toIDBKeyRange,
  type CollectionSchema,
  type IDBKeyRangeInit,
} from '../shared/schema.js';
import type { BatchOp } from '../shared/protocol.js';
import type { PendingOp } from '../sync/RemoteSyncAdapter.js';

export interface WriteOptions {
  /** When false, skip sync_queue (local-only DB). Default true. */
  enqueueSync?: boolean;
}

const META_STORE = '_meta';
const SYNC_QUEUE_STORE = 'sync_queue';
const CURSOR_KEY = 'sync_cursor';

type AppDB = IDBPDatabase<Record<string, unknown>>;

export class DbEngine {
  private db: AppDB | null = null;
  private schema: CollectionSchema | null = null;
  private dbName: string | null = null;

  async init(dbName: string, schema: CollectionSchema): Promise<void> {
    if (
      this.db &&
      this.dbName === dbName &&
      this.schema &&
      schemasEqual(this.schema, schema)
    ) {
      return;
    }

    // Re-open when schema evolves (IDB version is derived from schema hash).
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.dbName = dbName;
    this.schema = schema;
    const version = computeSchemaVersion(schema);

    this.db = (await openDB(dbName, version, {
      upgrade(db, oldVersion, newVersion, transaction) {
        void oldVersion;
        void newVersion;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'opId' });
        }

        for (const [storeName, def] of Object.entries(schema)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: def.keyPath,
            });
            for (const [indexName, keyPath] of Object.entries(
              def.indexes ?? {},
            )) {
              store.createIndex(indexName, keyPath);
            }
          } else {
            const store = transaction.objectStore(storeName);
            for (const [indexName, keyPath] of Object.entries(
              def.indexes ?? {},
            )) {
              if (!store.indexNames.contains(indexName)) {
                store.createIndex(indexName, keyPath);
              }
            }
          }
        }

        const existingStores = [...db.objectStoreNames];
        for (const name of existingStores) {
          if (
            name !== META_STORE &&
            name !== SYNC_QUEUE_STORE &&
            !(name in schema)
          ) {
            db.deleteObjectStore(name);
          }
        }
      },
    })) as AppDB;

    // Persist schema snapshot for diagnostics / future workers.
    await this.db.put(META_STORE, {
      key: 'schema',
      value: schema,
      schemaVersion: version,
    });
  }

  getSchema(): CollectionSchema | null {
    return this.schema;
  }

  private requireDb(): AppDB {
    if (!this.db) {
      throw dbError('NotConnected', 'Database not initialized');
    }
    return this.db;
  }

  async get(
    collection: string,
    id: string,
  ): Promise<(DocumentMeta & Record<string, unknown>) | null> {
    const db = this.requireDb();
    const doc = (await db.get(collection, id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;
    if (!doc || doc._deleted) {
      return null;
    }
    return doc;
  }

  async query(options: {
    collection: string;
    index?: string;
    range?: IDBKeyRangeInit;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<(DocumentMeta & Record<string, unknown>)[]> {
    const db = this.requireDb();
    const { collection, index, range, limit, includeDeleted } = options;
    const store = db.transaction(collection).store;
    const source = index ? store.index(index) : store;
    const keyRange = toIDBKeyRange(range);
    const results: (DocumentMeta & Record<string, unknown>)[] = [];
    let count = 0;
    for await (const cursor of source.iterate(keyRange)) {
      const doc = cursor.value as DocumentMeta & Record<string, unknown>;
      if (!includeDeleted && doc._deleted) {
        cursor.continue();
        continue;
      }
      results.push(doc);
      count++;
      if (limit !== undefined && count >= limit) {
        break;
      }
    }
    return results;
  }

  async count(options: {
    collection: string;
    index?: string;
    range?: IDBKeyRangeInit;
    includeDeleted?: boolean;
  }): Promise<number> {
    const db = this.requireDb();
    const { collection, index, range, includeDeleted } = options;
    const store = db.transaction(collection).store;
    const source = index ? store.index(index) : store;
    const keyRange = toIDBKeyRange(range);

    // Native count includes soft-deleted rows; filter when exclude deleted.
    if (includeDeleted) {
      return source.count(keyRange);
    }

    let n = 0;
    for await (const cursor of source.iterate(keyRange)) {
      const doc = cursor.value as DocumentMeta & Record<string, unknown>;
      if (!doc._deleted) {
        n++;
      }
    }
    return n;
  }

  async put(
    collection: string,
    payload: Record<string, unknown> & { id: string },
    options: WriteOptions = {},
  ): Promise<{
    doc: DocumentMeta & Record<string, unknown>;
    op: PendingOp | null;
  }> {
    const enqueueSync = options.enqueueSync !== false;
    const db = this.requireDb();
    const existing = (await db.get(collection, payload.id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;
    const doc = withMeta(payload.id, payload, existing ?? null);
    const op: PendingOp | null = enqueueSync
      ? {
          opId: crypto.randomUUID(),
          collection,
          doc,
          kind: 'put',
        }
      : null;

    if (enqueueSync && op) {
      const tx = db.transaction([collection, SYNC_QUEUE_STORE], 'readwrite');
      await tx.objectStore(collection).put(doc);
      await tx.objectStore(SYNC_QUEUE_STORE).put(op);
      await tx.done;
    } else {
      await db.put(collection, doc);
    }

    return { doc, op };
  }

  async delete(
    collection: string,
    id: string,
    options: WriteOptions = {},
  ): Promise<{
    doc: DocumentMeta & Record<string, unknown>;
    op: PendingOp | null;
  } | null> {
    const enqueueSync = options.enqueueSync !== false;
    const db = this.requireDb();
    const existing = (await db.get(collection, id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;
    if (!existing) {
      return null;
    }
    const doc = withSoftDelete(existing);
    const op: PendingOp | null = enqueueSync
      ? {
          opId: crypto.randomUUID(),
          collection,
          doc,
          kind: 'delete',
        }
      : null;

    if (enqueueSync && op) {
      const tx = db.transaction([collection, SYNC_QUEUE_STORE], 'readwrite');
      await tx.objectStore(collection).put(doc);
      await tx.objectStore(SYNC_QUEUE_STORE).put(op);
      await tx.done;
    } else {
      await db.put(collection, doc);
    }

    return { doc, op };
  }

  /**
   * Upsert many docs in one IDB transaction. Returns results in input order.
   */
  async putMany(
    collection: string,
    payloads: Array<Record<string, unknown> & { id: string }>,
    options: WriteOptions = {},
  ): Promise<
    Array<{
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }>
  > {
    if (payloads.length === 0) {
      return [];
    }
    const enqueueSync = options.enqueueSync !== false;
    const db = this.requireDb();
    const storeNames = enqueueSync
      ? [collection, SYNC_QUEUE_STORE]
      : [collection];
    const tx = db.transaction(storeNames, 'readwrite');
    const store = tx.objectStore(collection);
    const queue = enqueueSync ? tx.objectStore(SYNC_QUEUE_STORE) : null;
    const results: Array<{
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }> = [];

    for (const payload of payloads) {
      const existing = (await store.get(payload.id)) as
        | (DocumentMeta & Record<string, unknown>)
        | undefined;
      const doc = withMeta(payload.id, payload, existing ?? null);
      const op: PendingOp | null =
        enqueueSync && queue
          ? {
              opId: crypto.randomUUID(),
              collection,
              doc,
              kind: 'put',
            }
          : null;
      await store.put(doc);
      if (op && queue) {
        await queue.put(op);
      }
      results.push({ doc, op });
    }

    await tx.done;
    return results;
  }

  /**
   * Soft-delete many ids in one transaction. Missing ids are skipped.
   */
  async deleteMany(
    collection: string,
    ids: string[],
    options: WriteOptions = {},
  ): Promise<
    Array<{
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }>
  > {
    if (ids.length === 0) {
      return [];
    }
    const enqueueSync = options.enqueueSync !== false;
    const db = this.requireDb();
    const storeNames = enqueueSync
      ? [collection, SYNC_QUEUE_STORE]
      : [collection];
    const tx = db.transaction(storeNames, 'readwrite');
    const store = tx.objectStore(collection);
    const queue = enqueueSync ? tx.objectStore(SYNC_QUEUE_STORE) : null;
    const results: Array<{
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }> = [];

    for (const id of ids) {
      const existing = (await store.get(id)) as
        | (DocumentMeta & Record<string, unknown>)
        | undefined;
      if (!existing || existing._deleted) {
        continue;
      }
      const doc = withSoftDelete(existing);
      const op: PendingOp | null =
        enqueueSync && queue
          ? {
              opId: crypto.randomUUID(),
              collection,
              doc,
              kind: 'delete',
            }
          : null;
      await store.put(doc);
      if (op && queue) {
        await queue.put(op);
      }
      results.push({ doc, op });
    }

    await tx.done;
    return results;
  }

  /**
   * Soft-delete every non-deleted document in the collection (one transaction).
   */
  async clear(
    collection: string,
    options: WriteOptions = {},
  ): Promise<
    Array<{
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }>
  > {
    const db = this.requireDb();
    const all = (await db.getAll(collection)) as Array<
      DocumentMeta & Record<string, unknown>
    >;
    const ids = all.filter((d) => !d._deleted).map((d) => d.id);
    return this.deleteMany(collection, ids, options);
  }

  /**
   * Apply put/delete ops across one or more collections in a single IDB
   * transaction. Missing delete targets are skipped (same as `deleteMany`).
   *
   * Limits: all object stores must exist in the schema; stores are opened
   * upfront (IndexedDB cannot add stores mid-transaction); no nested txs.
   */
  async batch(
    ops: BatchOp[],
    options: WriteOptions = {},
  ): Promise<
    Array<{
      type: 'put' | 'delete';
      collection: string;
      id: string;
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }>
  > {
    if (ops.length === 0) {
      return [];
    }

    const schema = this.schema;
    if (!schema) {
      throw dbError('StorageError', 'Database not initialized');
    }

    for (const op of ops) {
      if (!(op.collection in schema)) {
        throw dbError(
          'InvalidRequest',
          `Unknown collection: ${op.collection}`,
        );
      }
    }

    const enqueueSync = options.enqueueSync !== false;
    const db = this.requireDb();
    const collections = [...new Set(ops.map((o) => o.collection))];
    const storeNames = enqueueSync
      ? [...collections, SYNC_QUEUE_STORE]
      : collections;
    const tx = db.transaction(storeNames, 'readwrite');
    const queue = enqueueSync ? tx.objectStore(SYNC_QUEUE_STORE) : null;
    const results: Array<{
      type: 'put' | 'delete';
      collection: string;
      id: string;
      doc: DocumentMeta & Record<string, unknown>;
      op: PendingOp | null;
    }> = [];

    for (const item of ops) {
      const store = tx.objectStore(item.collection);
      if (item.type === 'put') {
        const existing = (await store.get(item.doc.id)) as
          | (DocumentMeta & Record<string, unknown>)
          | undefined;
        const doc = withMeta(item.doc.id, item.doc, existing ?? null);
        const op: PendingOp | null =
          enqueueSync && queue
            ? {
                opId: crypto.randomUUID(),
                collection: item.collection,
                doc,
                kind: 'put',
              }
            : null;
        await store.put(doc);
        if (op && queue) {
          await queue.put(op);
        }
        results.push({
          type: 'put',
          collection: item.collection,
          id: doc.id,
          doc,
          op,
        });
      } else {
        const existing = (await store.get(item.id)) as
          | (DocumentMeta & Record<string, unknown>)
          | undefined;
        if (!existing || existing._deleted) {
          continue;
        }
        const doc = withSoftDelete(existing);
        const op: PendingOp | null =
          enqueueSync && queue
            ? {
                opId: crypto.randomUUID(),
                collection: item.collection,
                doc,
                kind: 'delete',
              }
            : null;
        await store.put(doc);
        if (op && queue) {
          await queue.put(op);
        }
        results.push({
          type: 'delete',
          collection: item.collection,
          id: item.id,
          doc,
          op,
        });
      }
    }

    await tx.done;
    return results;
  }

  async getPendingOps(): Promise<PendingOp[]> {
    const db = this.requireDb();
    return (await db.getAll(SYNC_QUEUE_STORE)) as PendingOp[];
  }

  async removePendingOps(opIds: string[]): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    for (const opId of opIds) {
      await tx.store.delete(opId);
    }
    await tx.done;
  }

  async getCursor(): Promise<string | null> {
    const db = this.requireDb();
    const row = (await db.get(META_STORE, CURSOR_KEY)) as
      | { key: string; value: string }
      | undefined;
    return row?.value ?? null;
  }

  async setCursor(cursor: string | null): Promise<void> {
    const db = this.requireDb();
    if (cursor === null) {
      await db.delete(META_STORE, CURSOR_KEY);
    } else {
      await db.put(META_STORE, { key: CURSOR_KEY, value: cursor });
    }
  }

  async applyRemoteChange(change: {
    collection: string;
    doc: DocumentMeta & Record<string, unknown>;
    kind: 'put' | 'delete';
  }): Promise<{
    doc: DocumentMeta & Record<string, unknown>;
    applied: boolean;
    /** Present when an existing local doc participated in LWW. */
    lww?: {
      outcome: 'local-wins' | 'remote-applied';
      local: DocumentMeta & Record<string, unknown>;
      remote: DocumentMeta & Record<string, unknown>;
    };
  }> {
    const db = this.requireDb();
    const { collection, doc, kind } = change;
    const existing = (await db.get(collection, doc.id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;

    if (existing && existing._updatedAt > doc._updatedAt) {
      return {
        doc: existing,
        applied: false,
        lww: { outcome: 'local-wins', local: existing, remote: doc },
      };
    }
    if (
      existing &&
      existing._updatedAt === doc._updatedAt &&
      existing._version >= doc._version
    ) {
      return {
        doc: existing,
        applied: false,
        lww: { outcome: 'local-wins', local: existing, remote: doc },
      };
    }

    const toStore =
      kind === 'delete' ? { ...doc, _deleted: true } : { ...doc, _deleted: false };

    await db.put(collection, toStore);
    if (existing) {
      return {
        doc: toStore,
        applied: true,
        lww: { outcome: 'remote-applied', local: existing, remote: doc },
      };
    }
    return { doc: toStore, applied: true };
  }
}
