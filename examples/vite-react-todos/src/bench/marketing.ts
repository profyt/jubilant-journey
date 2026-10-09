/**
 * Marketing-oriented browser harness (Playwright).
 * Compares worker-sync-db SharedWorker path vs Dexie on the same IndexedDB layer.
 * Not part of the public library API.
 */
import Dexie, { type EntityTable } from 'dexie';
import {
  createDatabase,
  defineSchema,
  type DatabaseClient,
} from 'worker-sync-db';
import { dedicatedWorkerUrl, sharedWorkerUrl } from '../db/workers.js';

const schema = defineSchema({
  items: {
    keyPath: 'id',
    indexes: { byKind: 'kind' },
  },
});

type Item = { id: string; title: string; kind: string };
type WsdDb = DatabaseClient<typeof schema>;

type DexieBenchDb = Dexie & {
  items: EntityTable<Item, 'id'>;
};

export type EngineThroughput = {
  engine: 'worker-sync-db' | 'dexie';
  n: number;
  putMs: number;
  getMs: number;
  queryMs: number;
  putOpsPerSec: number;
  getOpsPerSec: number;
  queryOpsPerSec: number;
  queryCount: number;
};

export type EngineLatency = {
  engine: 'worker-sync-db' | 'dexie';
  n: number;
  putP50Ms: number;
  putP95Ms: number;
  getP50Ms: number;
  getP95Ms: number;
};

export type MarketingBenchApi = {
  dbName: string;
  ready: () => Promise<true>;
  /** Clear both stores so engines start from empty. */
  reset: () => Promise<void>;
  wsdThroughput: (n?: number) => Promise<EngineThroughput>;
  dexieThroughput: (n?: number) => Promise<EngineThroughput>;
  wsdLatency: (n?: number) => Promise<EngineLatency>;
  dexieLatency: (n?: number) => Promise<EngineLatency>;
  putOneWsd: (id: string, title: string) => Promise<void>;
  clearChangeCount: () => void;
  getChangeCount: () => number;
  waitChanges: (expected: number, timeoutMs?: number) => Promise<number>;
  close: () => void;
};

declare global {
  interface Window {
    __mktBench?: MarketingBenchApi;
    __mktBenchError?: string;
  }
}

const statusEl = () => document.getElementById('status');

function setStatus(text: string, isError = false): void {
  const el = statusEl();
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('err', isError);
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

function params(): { dbName: string } {
  const q = new URLSearchParams(location.search);
  const dbName =
    q.get('db') ??
    `mkt-bench-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { dbName };
}

function openDexie(dbName: string): DexieBenchDb {
  const db = new Dexie(`${dbName}__dexie`) as DexieBenchDb;
  db.version(1).stores({
    items: 'id, kind',
  });
  return db;
}

async function boot(): Promise<void> {
  const { dbName } = params();

  let wsd: WsdDb;
  let dexie: DexieBenchDb;
  try {
    wsd = await createDatabase({
      schema,
      dbName,
      mode: 'shared',
      sharedWorker: sharedWorkerUrl,
      dedicatedWorker: dedicatedWorkerUrl,
    });
    dexie = openDexie(dbName);
    await dexie.open();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    window.__mktBenchError = msg;
    setStatus(`boot failed: ${msg}`, true);
    document.body.dataset.benchReady = '0';
    document.body.dataset.benchError = msg;
    throw err;
  }

  let changeCount = 0;

  const unsub = wsd.subscribe('items', () => {
    changeCount += 1;
  });

  const api: MarketingBenchApi = {
    dbName,
    ready: async () => true,

    async reset() {
      const existing = await wsd.query('items');
      for (const doc of existing) {
        await wsd.delete('items', doc.id);
      }
      await dexie.items.clear();
      changeCount = 0;
    },

    async wsdThroughput(n = 200) {
      const putStart = performance.now();
      for (let i = 0; i < n; i++) {
        await wsd.put('items', {
          id: `w-t-${i}`,
          title: `Item ${i}`,
          kind: i % 2 === 0 ? 'a' : 'b',
        });
      }
      const putMs = performance.now() - putStart;

      const getStart = performance.now();
      for (let i = 0; i < n; i++) {
        const doc = await wsd.get('items', `w-t-${i}`);
        if (!doc) throw new Error(`wsd missing w-t-${i}`);
      }
      const getMs = performance.now() - getStart;

      const queryStart = performance.now();
      const rows = await wsd.query('items', {
        index: 'byKind',
        range: { lower: 'a', upper: 'a' },
      });
      const queryMs = performance.now() - queryStart;

      return {
        engine: 'worker-sync-db',
        n,
        putMs,
        getMs,
        queryMs,
        putOpsPerSec: (n / putMs) * 1000,
        getOpsPerSec: (n / getMs) * 1000,
        queryOpsPerSec: queryMs > 0 ? (1 / queryMs) * 1000 : 0,
        queryCount: rows.length,
      };
    },

    async dexieThroughput(n = 200) {
      const putStart = performance.now();
      for (let i = 0; i < n; i++) {
        await dexie.items.put({
          id: `d-t-${i}`,
          title: `Item ${i}`,
          kind: i % 2 === 0 ? 'a' : 'b',
        });
      }
      const putMs = performance.now() - putStart;

      const getStart = performance.now();
      for (let i = 0; i < n; i++) {
        const doc = await dexie.items.get(`d-t-${i}`);
        if (!doc) throw new Error(`dexie missing d-t-${i}`);
      }
      const getMs = performance.now() - getStart;

      const queryStart = performance.now();
      const rows = await dexie.items.where('kind').equals('a').toArray();
      const queryMs = performance.now() - queryStart;

      return {
        engine: 'dexie',
        n,
        putMs,
        getMs,
        queryMs,
        putOpsPerSec: (n / putMs) * 1000,
        getOpsPerSec: (n / getMs) * 1000,
        queryOpsPerSec: queryMs > 0 ? (1 / queryMs) * 1000 : 0,
        queryCount: rows.length,
      };
    },

    async wsdLatency(n = 50) {
      const putSamples: number[] = [];
      const getSamples: number[] = [];
      for (let i = 0; i < n; i++) {
        const id = `w-lat-${i}`;
        const ps = performance.now();
        await wsd.put('items', { id, title: `L${i}`, kind: 'lat' });
        putSamples.push(performance.now() - ps);

        const gs = performance.now();
        await wsd.get('items', id);
        getSamples.push(performance.now() - gs);
      }
      putSamples.sort((a, b) => a - b);
      getSamples.sort((a, b) => a - b);
      return {
        engine: 'worker-sync-db',
        n,
        putP50Ms: percentile(putSamples, 50),
        putP95Ms: percentile(putSamples, 95),
        getP50Ms: percentile(getSamples, 50),
        getP95Ms: percentile(getSamples, 95),
      };
    },

    async dexieLatency(n = 50) {
      const putSamples: number[] = [];
      const getSamples: number[] = [];
      for (let i = 0; i < n; i++) {
        const id = `d-lat-${i}`;
        const ps = performance.now();
        await dexie.items.put({ id, title: `L${i}`, kind: 'lat' });
        putSamples.push(performance.now() - ps);

        const gs = performance.now();
        await dexie.items.get(id);
        getSamples.push(performance.now() - gs);
      }
      putSamples.sort((a, b) => a - b);
      getSamples.sort((a, b) => a - b);
      return {
        engine: 'dexie',
        n,
        putP50Ms: percentile(putSamples, 50),
        putP95Ms: percentile(putSamples, 95),
        getP50Ms: percentile(getSamples, 50),
        getP95Ms: percentile(getSamples, 95),
      };
    },

    async putOneWsd(id, title) {
      await wsd.put('items', { id, title, kind: 'x' });
    },

    clearChangeCount() {
      changeCount = 0;
    },

    getChangeCount() {
      return changeCount;
    },

    async waitChanges(expected, timeoutMs = 20_000) {
      const start = performance.now();
      while (changeCount < expected) {
        if (performance.now() - start > timeoutMs) {
          return changeCount;
        }
        await new Promise((r) => setTimeout(r, 5));
      }
      return changeCount;
    },

    close() {
      unsub();
      wsd.close();
      void dexie.close();
    },
  };

  window.__mktBench = api;
  document.body.dataset.benchReady = '1';
  document.body.dataset.dbName = dbName;
  setStatus(`ready\ndb=${dbName}\nengines=worker-sync-db+dexie`);
}

void boot().catch(() => {
  /* status already set */
});
