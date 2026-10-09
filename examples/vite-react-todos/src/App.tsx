import { useEffect, useState } from 'react';
import './App.css';
import { useDatabase } from './db/DatabaseProvider.js';
import { useTodos } from './db/useTodos.js';
import type { TodoStatus } from './db/schema.js';

type Filter = TodoStatus | 'all';

export function App() {
  const { error, syncStatus } = useDatabase();
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [pulse, setPulse] = useState(false);
  const { todos, loading, addTodo, toggleTodo, removeTodo, syncNow } =
    useTodos(filter);

  useEffect(() => {
    if (!syncStatus) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 600);
    return () => window.clearTimeout(t);
  }, [syncStatus?.pending, syncStatus?.lastSyncAt]);

  if (error) {
    return (
      <div className="shell">
        <div className="boot-error">
          <p className="boot-error__title">Could not start the local database</p>
          <p>{error}</p>
          <p className="boot-error__hint">
            If you run from source, build the library at the repo root:{' '}
            <code>npm run build</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true">
        <div className="atmosphere__mesh" />
        <div className="atmosphere__orbit atmosphere__orbit--a" />
        <div className="atmosphere__orbit atmosphere__orbit--b" />
        <svg className="atmosphere__ports" viewBox="0 0 800 400" fill="none">
          <path
            className="atmosphere__wire"
            d="M120 200 C260 80, 540 320, 680 200"
          />
          <circle className="atmosphere__node" cx="120" cy="200" r="8" />
          <circle className="atmosphere__node atmosphere__node--delay" cx="400" cy="200" r="10" />
          <circle className="atmosphere__node" cx="680" cy="200" r="8" />
        </svg>
      </div>

      <header className="hero">
        <p className="hero__brand">worker-sync-db</p>
        <h1 className="hero__headline">One database. Every tab. Offline-first.</h1>
        <p className="hero__lede">
          A small todos app powered by worker-sync-db: edits save instantly,
          every open tab stays in sync, and you can push changes to a mock server.
        </p>
        <div className="hero__cta">
          <a className="btn btn--primary" href="#playground">
            Try the playground
          </a>
          <a
            className="btn btn--ghost"
            href="https://github.com/profyt/jubilant-journey"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
        <p className="hero__hint">
          Tip: open this URL in a second tab — adds and toggles mirror instantly.
        </p>
      </header>

      <main id="playground" className="playground">
        <div className="playground__head">
          <h2>Live todos</h2>
          <p>
            Add or complete tasks — they persist offline. Open a second tab to see
            the same list update. Use Sync now to simulate sending data to your backend.
          </p>
        </div>

        <div className={`status ${pulse ? 'status--pulse' : ''}`}>
          <span
            className={`status__dot ${syncStatus?.online === false ? 'is-offline' : ''}`}
            title={syncStatus?.online === false ? 'Offline' : 'Online'}
          />
          <span>Pending: {syncStatus?.pending ?? '—'}</span>
          {syncStatus?.lastSyncAt ? (
            <span>
              Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
            </span>
          ) : (
            <span>Not synced yet</span>
          )}
          {syncStatus?.lastError && (
            <span className="status__error">{syncStatus.lastError}</span>
          )}
          <button
            type="button"
            className="btn btn--small"
            onClick={() => void syncNow()}
          >
            Sync now
          </button>
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void addTodo(title).then(() => setTitle(''));
          }}
        >
          <input
            type="text"
            placeholder="What should stay in sync?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading && todos.length === 0}
            aria-label="New todo title"
          />
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            Add
          </button>
        </form>

        <div className="filters" role="tablist" aria-label="Filter todos">
          {(['all', 'open', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'is-active' : ''}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && todos.length === 0 ? (
          <p className="empty">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="empty">No todos yet — add one, then open a second tab.</p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo, index) => (
              <li
                key={todo.id}
                className={todo.status === 'done' ? 'is-done' : ''}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={todo.status === 'done'}
                    onChange={() => void toggleTodo(todo)}
                  />
                  <span>{todo.title}</span>
                </label>
                <button
                  type="button"
                  className="todo-list__remove"
                  onClick={() => void removeTodo(todo.id)}
                  aria-label={`Delete ${todo.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="footer">
        <span>MIT · npm package <code>worker-sync-db</code></span>
      </footer>
    </div>
  );
}
