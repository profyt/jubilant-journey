/**
 * Minimal real-browser bench harness for Playwright.
 * Exposes window.__wsdBench — not part of the public library API.
 */
import {
  createDatabase,
  defineSchema,
  type DatabaseClient,
  type RemoteSyncAdapter,
} from 'worker-sync-db';
import { dedicatedWorkerUrl, sharedWorkerUrl } from '../db/workers.js';

const schema = defineSchema({
  items: {
    keyPath: 'id',
    indexes: { byKind: 'kind' },
  },
});

type BenchDb = DatabaseClient<typeof schema>;

export type ThroughputResult = {
  n: number;
  putMs: number;
  getMs: number;
  queryMs: number;
  putOpsPerSec: number;
  getOpsPerSec: number;
  queryCount: number;
};

export type LatencyResult = {
  n: number;
  putP50Ms: number;
  putP95Ms: number;
  getP50Ms: number;
  getP95Ms: number;
};

export type SyncBenchResult = {
  enqueued: number;
  syncMs: number;
  pendingAfter: number;
  pulled: number;
};

export type WsdBenchApi = {
  dbName: string;
  workerMode: string;
  crossTabTransport: string;
  ready: () => Promise<true>;
  throughput: (n?: number) => Promise<ThroughputResult>;
  latency: (n?: number) => Promise<LatencyResult>;
  putOne: (id: string, title: string) => Promise<void>;
  getOne: (id: string) => Promise<{ id: string; title: string } | null>;
  putManyPayload: (
    count: number,
    bytesPerDoc: number,
  ) => Promise<{ written: number; quotaExceeded: boolean; error?: string }>;
  reopenSameDb: () => Promise<{ ok: boolean; count: number; error?: string }>;
  waitChanges: (expected: number, timeoutMs?: number) => Promise<number>;
  clearChangeCount: () => void;
  getChangeCount: () => number;
  syncRoundtrip: (n?: number) => Promise<SyncBenchResult>;
  close: () => void;
};

declare global {
  interface Window {
    __wsdBench?: WsdBenchApi;
    __wsdBenchError?: string;
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

function createFastMockRemote(): RemoteSyncAdapter & {
  getPulled: () => number;
  reset: () => void;
} {
  const server = new Map<
    string,
    {
      id: string;
      _version: number;
      _updatedAt: number;
      _deleted?: boolean;
      [k: string]: unknown;
    }
  >();
  let pulled = 0;

  return {
    getPulled: () => pulled,
    reset: () => {
      server.clear();
      pulled = 0;
    },
    async pull(cursor) {
      const since = cursor ? Number(cursor) : 0;
      const changes = [...server.values()]
        .filter((doc) => doc._updatedAt > since)
        .map((doc) => ({
          collection: 'items' as const,
          kind: (doc._deleted ? 'delete' : 'put') as 'put' | 'delete',
          doc: { ...doc },
        }));
      pulled += changes.length;
      return { changes, nextCursor: String(Date.now()) };
    },
    async push(ops) {
      const applied: string[] = [];
      for (const op of ops) {
        server.set(op.doc.id, { ...op.doc });
        applied.push(op.opId);
      }
      return { applied };
    },
  };
}

function params(): { dbName: string; withRemote: boolean } {
  const q = new URLSearchParams(location.search);
  const dbName =
    q.get('db') ?? `wsd-bench-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { dbName, withRemote: q.get('remote') === '1' };
}

async function boot(): Promise<void> {
  const { dbName, withRemote } = params();
  const remote = withRemote ? createFastMockRemote() : undefined;

  let db: BenchDb;
  try {
    // `auto`: SharedWorker when available, dedicated (+ BC fan-out) otherwise.
    // Required for WebKit / Safari smoke; Chromium still resolves to shared.
    db = await createDatabase({
      schema,
      dbName,
      mode: 'auto',
      crossTabFallback: 'auto',
      sharedWorker: sharedWorkerUrl,
      dedicatedWorker: dedicatedWorkerUrl,
      remote,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    window.__wsdBenchError = msg;
    setStatus(`boot failed: ${msg}`, true);
    document.body.dataset.benchReady = '0';
    document.body.dataset.benchError = msg;
    throw err;
  }

  const workerMode = db.getWorkerMode();
  const crossTabTransport = db.getCrossTabTransport();

  let changeCount = 0;
  let unsub = db.subscribe('items', () => {
    changeCount += 1;
  });

  const api: WsdBenchApi = {
    dbName,
    workerMode,
    crossTabTransport,
    ready: async () => true,

    async throughput(n = 150) {
      const putStart = performance.now();
      for (let i = 0; i < n; i++) {
        await db.put('items', {
          id: `t-${i}`,
          title: `Item ${i}`,
          kind: i % 2 === 0 ? 'a' : 'b',
        });
      }
      const putMs = performance.now() - putStart;

      const getStart = performance.now();
      for (let i = 0; i < n; i++) {
        const doc = await db.get('items', `t-${i}`);
        if (!doc) throw new Error(`missing t-${i}`);
      }
      const getMs = performance.now() - getStart;

      const queryStart = performance.now();
      const rows = await db.query('items', {
        index: 'byKind',
        range: { lower: 'a', upper: 'a' },
      });
      const queryMs = performance.now() - queryStart;

      return {
        n,
        putMs,
        getMs,
        queryMs,
        putOpsPerSec: (n / putMs) * 1000,
        getOpsPerSec: (n / getMs) * 1000,
        queryCount: rows.length,
      };
    },

    async latency(n = 40) {
      const putSamples: number[] = [];
      const getSamples: number[] = [];
      for (let i = 0; i < n; i++) {
        const id = `lat-${i}`;
        const ps = performance.now();
        await db.put('items', { id, title: `L${i}`, kind: 'lat' });
        putSamples.push(performance.now() - ps);

        const gs = performance.now();
        await db.get('items', id);
        getSamples.push(performance.now() - gs);
      }
      putSamples.sort((a, b) => a - b);
      getSamples.sort((a, b) => a - b);
      return {
        n,
        putP50Ms: percentile(putSamples, 50),
        putP95Ms: percentile(putSamples, 95),
        getP50Ms: percentile(getSamples, 50),
        getP95Ms: percentile(getSamples, 95),
      };
    },

    async putOne(id, title) {
      await db.put('items', { id, title, kind: 'x' });
    },

    async getOne(id) {
      const doc = await db.get('items', id);
      if (!doc) return null;
      return { id: String(doc.id), title: String(doc.title ?? '') };
    },

    async putManyPayload(count, bytesPerDoc) {
      const chunk = 'x'.repeat(Math.max(1, bytesPerDoc));
      let written = 0;
      try {
        // Batch in chunks to keep CI time bounded while still stressing IDB.
        const batchSize = 25;
        for (let i = 0; i < count; i += batchSize) {
          const slice = Math.min(batchSize, count - i);
          const docs = Array.from({ length: slice }, (_, j) => {
            const n = i + j;
            return {
              id: `q-${n}`,
              title: chunk,
              kind: 'quota',
            };
          });
          await db.putMany('items', docs);
          written += slice;
        }
        return { written, quotaExceeded: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : '';
        const quotaExceeded =
          name === 'QuotaExceededError' ||
          /quotaexceeded|quota.?exceeded|storage.*full/i.test(message);
        return { written, quotaExceeded, error: message };
      }
    },

    async reopenSameDb() {
      try {
        unsub();
        db.close();
        db = await createDatabase({
          schema,
          dbName,
          mode: 'auto',
          crossTabFallback: 'auto',
          sharedWorker: sharedWorkerUrl,
          dedicatedWorker: dedicatedWorkerUrl,
          remote,
        });
        changeCount = 0;
        unsub = db.subscribe('items', () => {
          changeCount += 1;
        });
        api.workerMode = db.getWorkerMode();
        api.crossTabTransport = db.getCrossTabTransport();
        const rows = await db.query('items');
        return { ok: true, count: rows.length };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, count: 0, error: message };
      }
    },

    clearChangeCount() {
      changeCount = 0;
    },

    getChangeCount() {
      return changeCount;
    },

    async waitChanges(expected, timeoutMs = 15_000) {
      const start = performance.now();
      while (changeCount < expected) {
        if (performance.now() - start > timeoutMs) {
          return changeCount;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      return changeCount;
    },

    async syncRoundtrip(n = 40) {
      if (!remote) {
        throw new Error('open with ?remote=1 for sync bench');
      }
      // Each put may fire auto-syncNow; drain until the queue is empty.
      remote.reset();
      for (let i = 0; i < n; i++) {
        await db.put('items', {
          id: `sync-${i}`,
          title: `S${i}`,
          kind: 'sync',
        });
      }
      const start = performance.now();
      let status = await db.getSyncStatus();
      while (status.pending > 0 && performance.now() - start < 15_000) {
        status = await db.syncNow();
        if (status.pending > 0) {
          await new Promise((r) => setTimeout(r, 40));
          status = await db.getSyncStatus();
        }
      }
      const syncMs = performance.now() - start;
      return {
        enqueued: n,
        syncMs,
        pendingAfter: status.pending,
        pulled: remote.getPulled(),
      };
    },

    close() {
      unsub();
      db.close();
    },
  };

  window.__wsdBench = api;
  document.body.dataset.benchReady = '1';
  document.body.dataset.dbName = dbName;
  document.body.dataset.workerMode = workerMode;
  document.body.dataset.crossTabTransport = crossTabTransport;
  setStatus(
    `ready\ndb=${dbName}\nmode=${workerMode}\ntransport=${crossTabTransport}\nremote=${withRemote ? '1' : '0'}`,
  );
}

void boot().catch(() => {
  /* status already set */
});
