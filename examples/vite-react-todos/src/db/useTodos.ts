import { useCallback, useMemo } from 'react';
import { useQuery } from 'worker-sync-db/react';
import type { Todo, TodoDoc, TodoStatus } from './schema.js';
import { useDatabase } from './DatabaseProvider.js';

function toTodo(doc: TodoDoc): Todo {
  return {
    id: doc.id,
    title: String(doc.title ?? ''),
    status: doc.status as TodoStatus,
  };
}

export function useTodos(filter: TodoStatus | 'all') {
  const { db } = useDatabase();
  const { data, loading, refetch } = useQuery(db, 'todos');

  const todos = useMemo(() => {
    let items = data
      .filter((d) => !d._deleted)
      .map((d) => toTodo(d as TodoDoc));
    if (filter !== 'all') {
      items = items.filter((t) => t.status === filter);
    }
    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [data, filter]);

  const addTodo = useCallback(
    async (title: string) => {
      if (!db || !title.trim()) return;
      await db.put('todos', {
        id: crypto.randomUUID(),
        title: title.trim(),
        status: 'open',
      });
    },
    [db],
  );

  const toggleTodo = useCallback(
    async (todo: Todo) => {
      if (!db) return;
      await db.put('todos', {
        ...todo,
        status: todo.status === 'open' ? 'done' : 'open',
      });
    },
    [db],
  );

  const removeTodo = useCallback(
    async (id: string) => {
      if (!db) return;
      await db.delete('todos', id);
    },
    [db],
  );

  const syncNow = useCallback(async () => {
    if (!db) return;
    await db.syncNow();
  }, [db]);

  return {
    todos,
    loading,
    addTodo,
    toggleTodo,
    removeTodo,
    syncNow,
    refetch,
  };
}
