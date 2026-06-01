import { useCallback, useEffect, useState } from 'react';
import type { Todo, TodoDoc, TodoStatus } from './schema.js';
import { useDatabase } from './DatabaseProvider.js';

function toTodo(doc: TodoDoc): Todo {
  return {
    id: doc.id,
    title: doc.title,
    status: doc.status as TodoStatus,
  };
}

export function useTodos(filter: TodoStatus | 'all') {
  const { db } = useDatabase();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!db) return;
    const docs = await db.query('todos');
    let items = docs
      .filter((d) => !d._deleted)
      .map((d) => toTodo(d as TodoDoc));
    if (filter !== 'all') {
      items = items.filter((t) => t.status === filter);
    }
    items.sort((a, b) => a.title.localeCompare(b.title));
    setTodos(items);
  }, [db, filter]);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    void reload().finally(() => setLoading(false));

    const unsub = db.subscribe('todos', () => {
      void reload();
    });

    return unsub;
  }, [db, reload]);

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
  };
}
