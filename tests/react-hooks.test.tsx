/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { DatabaseClient } from '../src/client/createDatabase.js';
import { DatabaseProvider } from '../src/react/DatabaseProvider.js';
import { useQuery } from '../src/react/useQuery.js';
import { useSubscribe } from '../src/react/useSubscribe.js';
import { useSyncStatus } from '../src/react/useSyncStatus.js';

type Schema = {
  todos: { keyPath: string };
};

function createMockDb(initial: Array<Record<string, unknown> & { id: string }> = []) {
  let docs = [...initial];
  const listeners = new Set<(e: unknown) => void>();

  const db = {
    async query() {
      return docs.map((d) => ({ ...d, _version: 1, _updatedAt: 1 }));
    },
    subscribe(_collection: string, listener: (e: unknown) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async getSyncStatus() {
      return { pending: 2, lastSyncAt: null, lastError: null, online: true };
    },
    onSyncStatusChange(listener: (s: unknown) => void) {
      listener({ pending: 2, lastSyncAt: null, lastError: null, online: true });
      return () => {};
    },
    emit(event: unknown) {
      for (const l of listeners) l(event);
    },
    setDocs(next: typeof docs) {
      docs = next;
    },
  };

  return db as unknown as DatabaseClient<Schema> & {
    emit: (e: unknown) => void;
    setDocs: (d: typeof docs) => void;
  };
}

describe('react hooks', () => {
  it('useQuery loads data and refreshes on subscribe', async () => {
    const db = createMockDb([{ id: '1', title: 'A' }]);

    const { result } = renderHook(() => useQuery(db, 'todos'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.id).toBe('1');

    db.setDocs([
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
    ]);

    await act(async () => {
      db.emit({ type: 'put', collection: 'todos', id: '2', doc: {} });
    });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('useQuery works via DatabaseProvider without db arg', async () => {
    const db = createMockDb([{ id: 'x', title: 'Via ctx' }]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatabaseProvider db={db}>{children}</DatabaseProvider>
    );

    const { result } = renderHook(() => useQuery('todos'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data[0]?.title).toBe('Via ctx');
  });

  it('useSubscribe invokes listener', async () => {
    const db = createMockDb();
    const listener = vi.fn();

    renderHook(() => useSubscribe(db, 'todos', listener));

    await act(async () => {
      db.emit({ type: 'put', collection: 'todos', id: '1', doc: { id: '1' } });
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('useSyncStatus tracks status', async () => {
    const db = createMockDb();
    const { result } = renderHook(() => useSyncStatus(db));

    await waitFor(() => expect(result.current?.pending).toBe(2));
    expect(result.current?.online).toBe(true);
  });
});
