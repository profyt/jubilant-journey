import { useEffect, useState, type CSSProperties } from 'react';
import './App.css';
import { useDatabase } from './db/DatabaseProvider.js';
import { AGENTS, useLiveAgents } from './db/useLiveAgents.js';
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
  const live = useLiveAgents();

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

  const base = import.meta.env.BASE_URL;
  // On Pages, docs live under /docs/ next to this demo; locally base is `/`.
  const docsRoot =
    base === '/' || base === './'
      ? 'https://profyt.github.io/jubilant-journey/docs/'
      : `${base}docs/`;
  // Prefer Russian docs when the browser locale is Russian (VitePress: /ru/).
  const docsLocale =
    typeof navigator !== 'undefined' &&
    /^ru\b/i.test(navigator.language || '')
      ? 'ru/'
      : '';
  const docsHome = `${docsRoot}${docsLocale}`;
  const docsExamples = `${docsRoot}${docsLocale}examples/typescript`;

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
          <circle
            className="atmosphere__node atmosphere__node--delay"
            cx="400"
            cy="200"
            r="10"
          />
          <circle className="atmosphere__node" cx="680" cy="200" r="8" />
        </svg>
      </div>

      <nav className="site-nav" aria-label="Site">
        <a className="site-nav__brand" href={docsHome}>
          worker-sync-db
        </a>
        <div className="site-nav__links">
          <a href={docsHome}>Docs</a>
          <a href={docsExamples}>Examples</a>
          <a href={import.meta.env.BASE_URL} aria-current="page">
            Demo
          </a>
          <a
            href="https://github.com/profyt/jubilant-journey"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </nav>

      <div className="stage">
        <header className="hero">
          <p className="hero__brand">worker-sync-db</p>
          <h1 className="hero__headline">One database. Every tab. Offline-first.</h1>
          <p className="hero__lede">
            Edits save in a SharedWorker, every open tab stays in sync, and a mock
            remote adapter shows push/pull without leaving the page.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="#swarm">
              Watch live agents
            </a>
            <a className="btn btn--ghost" href={docsHome}>
              Documentation
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
          <div className="playground__chrome">
            <div className="playground__head">
              <h2>Live todos</h2>
              <p>
                Add or complete tasks — they persist offline. Agents below also write
                here through the same worker DB.
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
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!title.trim()}
              >
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
          </div>

          <div className="playground__list">
            {loading && todos.length === 0 ? (
              <p className="empty">Loading…</p>
            ) : todos.length === 0 ? (
              <p className="empty">
                No todos yet — add one, or let agents start writing.
              </p>
            ) : (
              <ul className="todo-list">
                {todos.map((todo, index) => (
                  <li
                    key={todo.id}
                    className={todo.status === 'done' ? 'is-done' : ''}
                    style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
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
          </div>
        </main>
      </div>

      <section id="swarm" className="swarm" aria-labelledby="swarm-title">
        <div className="swarm__intro">
          <h2 id="swarm-title">Sync swarm</h2>
          <p>
            Simulated peers write through the real SharedWorker database, flush the
            mock remote on a timer, and pull seeded server changes — watch the
            activity stream move without clicking.
          </p>
        </div>

        <div className="swarm__meter" aria-live="polite">
          <div className="swarm__stat">
            <span className="swarm__stat-label">Live events</span>
            <span className="swarm__stat-value">{live.eventCount}</span>
          </div>
          <div className="swarm__stat">
            <span className="swarm__stat-label">Open todos</span>
            <span className="swarm__stat-value">{live.openCount}</span>
          </div>
          <div className="swarm__stat">
            <span className="swarm__stat-label">Pending sync</span>
            <span className="swarm__stat-value">
              {live.syncStatus?.pending ?? '—'}
            </span>
          </div>
          <div className="swarm__agents" aria-label="Agents">
            {AGENTS.map((agent) => (
              <span
                key={agent.id}
                className={`swarm__agent ${live.activeAgent === agent.name ? 'is-hot' : ''}`}
                style={{ '--agent': agent.hue } as CSSProperties}
              >
                {agent.name}
              </span>
            ))}
            <span
              className={`swarm__agent swarm__agent--remote ${live.activeAgent === 'Orbit' ? 'is-hot' : ''}`}
            >
              Orbit
            </span>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => live.setRunning((v) => !v)}
          >
            {live.running ? 'Pause swarm' : 'Resume swarm'}
          </button>
        </div>

        {live.lastPulse && (
          <p className="swarm__pulse" key={live.lastPulse + live.eventCount}>
            {live.lastPulse}
          </p>
        )}

        <ol className="swarm__feed">
          {live.activityLoading && live.activities.length === 0 ? (
            <li className="swarm__feed-empty">Booting agent stream…</li>
          ) : live.activities.length === 0 ? (
            <li className="swarm__feed-empty">Waiting for the first write…</li>
          ) : (
            live.activities.map((row, index) => (
              <li
                key={row.id}
                className={`swarm__row swarm__row--${row.kind}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <time dateTime={new Date(row.at).toISOString()}>
                  {new Date(row.at).toLocaleTimeString()}
                </time>
                <span className="swarm__row-agent">{row.agent}</span>
                <span className="swarm__row-msg">{row.message}</span>
              </li>
            ))
          )}
        </ol>
      </section>

      <footer className="footer">
        <span>
          MIT · npm package <code>worker-sync-db</code>
        </span>
      </footer>
    </div>
  );
}
