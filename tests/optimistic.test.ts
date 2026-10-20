import { describe, expect, it, vi } from 'vitest';
import {
  createTempId,
  isTempId,
  withOptimisticPut,
} from '../src/client/optimistic.js';
import type { DatabaseClient } from '../src/client/createDatabase.js';

describe('optimistic helpers', () => {
  it('createTempId / isTempId', () => {
    const id = createTempId();
    expect(isTempId(id)).toBe(true);
    expect(isTempId('real-1')).toBe(false);
    expect(isTempId(createTempId('x'), 'x')).toBe(true);
  });

  it('withOptimisticPut keeps doc when action succeeds', async () => {
    const put = vi.fn(async (_c: string, doc: { id: string }) => ({
      ...doc,
      _version: 1,
      _updatedAt: 1,
    }));
    const del = vi.fn();
    const db = { put, delete: del } as unknown as DatabaseClient<{
      todos: { keyPath: string };
    }>;

    const saved = await withOptimisticPut(
      db,
      'todos',
      { id: '1', title: 'A' },
      async () => {},
    );
    expect(saved.id).toBe('1');
    expect(del).not.toHaveBeenCalled();
  });

  it('withOptimisticPut soft-deletes on action failure', async () => {
    const put = vi.fn(async (_c: string, doc: { id: string }) => ({
      ...doc,
      _version: 1,
      _updatedAt: 1,
    }));
    const del = vi.fn(async () => ({}));
    const db = { put, delete: del } as unknown as DatabaseClient<{
      todos: { keyPath: string };
    }>;

    await expect(
      withOptimisticPut(db, 'todos', { id: '1', title: 'A' }, async () => {
        throw new Error('network');
      }),
    ).rejects.toThrow('network');
    expect(del).toHaveBeenCalledWith('todos', '1');
  });
});
