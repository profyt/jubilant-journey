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
      range: IDBKeyRange.only('open'),
    });
    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe('1');
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
    const merged = await engine.applyRemoteChange({
      collection: 'todos',
      doc: remote,
      kind: 'put',
    });
    expect(merged.title).toBe('Remote');
  });
});
