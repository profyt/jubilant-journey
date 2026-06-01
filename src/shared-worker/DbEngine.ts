import { openDB, type IDBPDatabase } from 'idb';
import { dbError } from '../shared/errors.js';
import type { DocumentMeta } from '../shared/meta.js';
import { withMeta, withSoftDelete } from '../shared/meta.js';
import {
  computeSchemaVersion,
  type CollectionSchema,
  type IDBKeyRangeInit,
} from '../shared/schema.js';
import type { PendingOp } from '../sync/RemoteSyncAdapter.js';

const META_STORE = '_meta';
const SYNC_QUEUE_STORE = 'sync_queue';
const CURSOR_KEY = 'sync_cursor';

type AppDB = IDBPDatabase<Record<string, unknown>>;

export class DbEngine {
  private db: AppDB | null = null;
  private schema: CollectionSchema | null = null;
  private dbName: string | null = null;

  async init(dbName: string, schema: CollectionSchema): Promise<void> {
    if (this.db && this.dbName === dbName && this.schema) {
      return;
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
    const keyRange = range ? IDBKeyRange.bound(range.lower, range.upper, range.lowerOpen, range.upperOpen) : undefined;
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

  async put(
    collection: string,
    payload: Record<string, unknown> & { id: string },
  ): Promise<{ doc: DocumentMeta & Record<string, unknown>; op: PendingOp }> {
    const db = this.requireDb();
    const existing = (await db.get(collection, payload.id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;
    const doc = withMeta(payload.id, payload, existing ?? null);
    const op: PendingOp = {
      opId: crypto.randomUUID(),
      collection,
      doc,
      kind: 'put',
    };

    const tx = db.transaction([collection, SYNC_QUEUE_STORE], 'readwrite');
    await tx.objectStore(collection).put(doc);
    await tx.objectStore(SYNC_QUEUE_STORE).put(op);
    await tx.done;

    return { doc, op };
  }

  async delete(
    collection: string,
    id: string,
  ): Promise<{ doc: DocumentMeta & Record<string, unknown>; op: PendingOp } | null> {
    const db = this.requireDb();
    const existing = (await db.get(collection, id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;
    if (!existing) {
      return null;
    }
    const doc = withSoftDelete(existing);
    const op: PendingOp = {
      opId: crypto.randomUUID(),
      collection,
      doc,
      kind: 'delete',
    };

    const tx = db.transaction([collection, SYNC_QUEUE_STORE], 'readwrite');
    await tx.objectStore(collection).put(doc);
    await tx.objectStore(SYNC_QUEUE_STORE).put(op);
    await tx.done;

    return { doc, op };
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
  }): Promise<DocumentMeta & Record<string, unknown>> {
    const db = this.requireDb();
    const { collection, doc, kind } = change;
    const existing = (await db.get(collection, doc.id)) as
      | (DocumentMeta & Record<string, unknown>)
      | undefined;

    if (existing && existing._updatedAt > doc._updatedAt) {
      return existing;
    }
    if (
      existing &&
      existing._updatedAt === doc._updatedAt &&
      existing._version >= doc._version
    ) {
      return existing;
    }

    const toStore =
      kind === 'delete' ? { ...doc, _deleted: true } : { ...doc, _deleted: false };

    await db.put(collection, toStore);
    return toStore;
  }
}
