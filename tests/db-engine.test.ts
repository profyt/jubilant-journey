import { describe, expect, it, beforeEach } from 'vitest';
import { DbEngine } from '../src/shared-worker/DbEngine.js';

const schema = {
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
} as const;

describe('DbEngine', () => {
  const engine = new DbEngine();

  beforeEach(async () => {
    await engine.init(`test-db-${Math.random()}`, schema);
  });

  it('puts and gets a document', async () => {
    const { doc } = await engine.put('todos', {
      id: '1',
      title: 'Test',
      status: 'open',
    });

    expect(doc.id).toBe('1');
    expect(doc._version).toBe(1);
    expect(doc.title).toBe('Test');

    const loaded = await engine.get('todos', '1');
    expect(loaded?.title).toBe('Test');
  });

  it('increments version on update', async () => {
    await engine.put('todos', { id: '1', title: 'A', status: 'open' });
    const { doc } = await engine.put('todos', {
      id: '1',
      title: 'B',
      status: 'open',
    });
    expect(doc._version).toBe(2);
    expect(doc.title).toBe('B');
  });

  it('soft deletes a document', async () => {
    await engine.put('todos', { id: '1', title: 'A', status: 'open' });
    await engine.delete('todos', '1');
    const loaded = await engine.get('todos', '1');
    expect(loaded).toBeNull();
  });

  it('enqueues pending ops on put', async () => {
    await engine.put('todos', { id: '1', title: 'A', status: 'open' });
    const pending = await engine.getPendingOps();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.kind).toBe('put');
  });

  it('queries by index', async () => {
    await engine.put('todos', { id: '1', title: 'A', status: 'open' });
    await engine.put('todos', { id: '2', title: 'B', status: 'done' });
    const open = await engine.query({
      collection: 'todos',
      index: 'byStatus',
      range: { lower: 'open', upper: 'open' },
    });
    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe('1');
  });

  it('queries with lowerBound range', async () => {
    await engine.put('todos', { id: '1', title: 'A', status: 'open' });
    await engine.put('todos', { id: '2', title: 'B', status: 'done' });
    await engine.put('todos', { id: '3', title: 'C', status: 'pending' });
    const fromDone = await engine.query({
      collection: 'todos',
      index: 'byStatus',
      range: { lower: 'done' },
    });
    expect(fromDone.map((d) => d.status).sort()).toEqual(['done', 'open', 'pending']);
  });

  it('skips sync queue when enqueueSync is false', async () => {
    await engine.put(
      'todos',
      { id: '1', title: 'Local only', status: 'open' },
      { enqueueSync: false },
    );
    expect(await engine.getPendingOps()).toHaveLength(0);
    expect((await engine.get('todos', '1'))?.title).toBe('Local only');
  });

  it('applies remote change with LWW', async () => {
    await engine.put('todos', { id: '1', title: 'Local', status: 'open' });
    const remote = {
      id: '1',
      title: 'Remote',
      status: 'open',
      _version: 5,
      _updatedAt: Date.now() + 1000,
    };
    const { doc: merged, applied } = await engine.applyRemoteChange({
      collection: 'todos',
      doc: remote,
      kind: 'put',
    });
    expect(applied).toBe(true);
    expect(merged.title).toBe('Remote');
  });

  it('putMany writes all docs and enqueues ops', async () => {
    const results = await engine.putMany('todos', [
      { id: '1', title: 'A', status: 'open' },
      { id: '2', title: 'B', status: 'done' },
    ]);
    expect(results).toHaveLength(2);
    expect(await engine.get('todos', '1')).toMatchObject({ title: 'A' });
    expect(await engine.get('todos', '2')).toMatchObject({ title: 'B' });
    expect(await engine.getPendingOps()).toHaveLength(2);
  });

  it('putMany skips sync queue when enqueueSync is false', async () => {
    await engine.putMany(
      'todos',
      [{ id: '1', title: 'A', status: 'open' }],
      { enqueueSync: false },
    );
    expect(await engine.getPendingOps()).toHaveLength(0);
  });

  it('deleteMany soft-deletes found ids and skips missing', async () => {
    await engine.putMany(
      'todos',
      [
        { id: '1', title: 'A', status: 'open' },
        { id: '2', title: 'B', status: 'open' },
      ],
      { enqueueSync: false },
    );
    const deleted = await engine.deleteMany('todos', ['1', 'missing', '2'], {
      enqueueSync: false,
    });
    expect(deleted.map((d) => d.doc.id).sort()).toEqual(['1', '2']);
    expect(await engine.get('todos', '1')).toBeNull();
    expect(await engine.get('todos', '2')).toBeNull();
  });

  it('clear soft-deletes all live documents', async () => {
    await engine.putMany(
      'todos',
      [
        { id: '1', title: 'A', status: 'open' },
        { id: '2', title: 'B', status: 'open' },
      ],
      { enqueueSync: false },
    );
    const cleared = await engine.clear('todos', { enqueueSync: false });
    expect(cleared).toHaveLength(2);
    expect(await engine.query({ collection: 'todos' })).toHaveLength(0);
  });

  it('rejects stale remote change', async () => {
    const { doc: local } = await engine.put('todos', {
      id: '1',
      title: 'Local',
      status: 'open',
    });
    const { applied, doc } = await engine.applyRemoteChange({
      collection: 'todos',
      doc: {
        id: '1',
        title: 'Stale',
        status: 'open',
        _version: 1,
        _updatedAt: local._updatedAt - 1000,
      },
      kind: 'put',
    });
    expect(applied).toBe(false);
    expect(doc.title).toBe('Local');
  });
});
