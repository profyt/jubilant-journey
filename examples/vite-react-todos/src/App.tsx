import { useState } from 'react';
import './App.css';
import { useDatabase } from './db/DatabaseProvider.js';
import { useTodos } from './db/useTodos.js';
import type { TodoStatus } from './db/schema.js';

type Filter = TodoStatus | 'all';

export function App() {
  const { error, syncStatus } = useDatabase();
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const { todos, loading, addTodo, toggleTodo, removeTodo, syncNow } =
    useTodos(filter);

  if (error) {
    return (
      <div className="app">
        <p className="error">Failed to open database: {error}</p>
        <p>
          Run <code>npm run build</code> in the repository root, then{' '}
          <code>npm install</code> in this example folder.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>worker-sync-db todos</h1>

      <div className="banner">
        Open this page in <strong>two browser tabs</strong> on the same origin.
        Adding or toggling a todo in one tab updates the other via SharedWorker
        fan-out.
      </div>

      {syncStatus && (
        <div className="status-bar">
          <span
            className={`dot ${syncStatus.online ? '' : 'offline'}`}
            title={syncStatus.online ? 'Online' : 'Offline'}
          />
          <span>Pending sync: {syncStatus.pending}</span>
          {syncStatus.lastSyncAt && (
            <span>
              Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
            </span>
          )}
          {syncStatus.lastError && (
            <span style={{ color: '#b91c1c' }}>{syncStatus.lastError}</span>
          )}
          <button type="button" className="secondary" onClick={() => void syncNow()}>
            Sync now
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addTodo(title).then(() => setTitle(''));
        }}
      >
        <input
          type="text"
          placeholder="New todo…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !title.trim()}>
          Add
        </button>
      </form>

      <div className="filters">
        {(['all', 'open', 'done'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading">Loading…</p>
      ) : todos.length === 0 ? (
        <p className="loading">No todos yet.</p>
      ) : (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id} className={todo.status === 'done' ? 'done' : ''}>
              <input
                type="checkbox"
                checked={todo.status === 'done'}
                onChange={() => void toggleTodo(todo)}
              />
              <span style={{ flex: 1 }}>{todo.title}</span>
              <button
                type="button"
                className="icon"
                onClick={() => void removeTodo(todo.id)}
                aria-label="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
