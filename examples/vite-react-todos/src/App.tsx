import { useEffect, useState, type CSSProperties } from 'react';
import './App.css';
import { useDatabase } from './db/DatabaseProvider.js';
import { AGENTS, useLiveAgents } from './db/useLiveAgents.js';
import { useTodos } from './db/useTodos.js';
import type { TodoStatus } from './db/schema.js';
import {
  detectLocale,
  messages,
  persistLocale,
  type Locale,
} from './i18n.js';
import { ConflictPanel } from './ConflictPanel.js';

type Filter = TodoStatus | 'all';

export function App() {
  const { error, syncStatus } = useDatabase();
  const [locale, setLocale] = useState<Locale>(() => detectLocale());
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [pulse, setPulse] = useState(false);
  const { todos, loading, addTodo, toggleTodo, removeTodo, syncNow } =
    useTodos(filter);
  const live = useLiveAgents(locale);
  const t = messages[locale];

  useEffect(() => {
    persistLocale(locale);
    document.documentElement.lang = locale;
    document.title = t.pageTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t.metaDescription);
  }, [locale, t]);

  useEffect(() => {
    if (!syncStatus) return;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 600);
    return () => window.clearTimeout(timer);
  }, [syncStatus?.pending, syncStatus?.lastSyncAt]);

  const base = import.meta.env.BASE_URL;
  // On Pages, docs live under /docs/ next to this demo; locally base is `/`.
  const docsRoot =
    base === '/' || base === './'
      ? 'https://profyt.github.io/jubilant-journey/docs/'
      : `${base}docs/`;
  const docsLocale = locale === 'ru' ? 'ru/' : '';
  const docsHome = `${docsRoot}${docsLocale}`;
  const docsExamples = `${docsRoot}${docsLocale}examples/typescript`;
  const starterHome =
    base === '/' || base === './'
      ? 'https://profyt.github.io/jubilant-journey/starter/'
      : `${base}starter/`;

  if (error) {
    return (
      <div className="shell">
        <div className="boot-error">
          <p className="boot-error__title">{t.bootTitle}</p>
          <p>{error}</p>
          <p className="boot-error__hint">
            {t.bootHint} <code>npm run build</code>.
          </p>
        </div>
      </div>
    );
  }

  const filterLabels: Record<Filter, string> = {
    all: t.filterAll,
    open: t.filterOpen,
    done: t.filterDone,
  };

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

      <nav className="site-nav" aria-label={t.navAria}>
        <a className="site-nav__brand" href={docsHome}>
          worker-sync-db
        </a>
        <div className="site-nav__links">
          <a href={docsHome}>{t.navDocs}</a>
          <a href={docsExamples}>{t.navExamples}</a>
          <a href={import.meta.env.BASE_URL} aria-current="page">
            {t.navDemo}
          </a>
          <a href={starterHome}>{t.navStarter}</a>
          <a
            href="https://github.com/profyt/jubilant-journey"
            target="_blank"
            rel="noreferrer"
          >
            {t.navGitHub}
          </a>
          <div
            className="site-nav__lang"
            role="group"
            aria-label={t.langSwitcherAria}
          >
            <button
              type="button"
              className={locale === 'en' ? 'is-active' : ''}
              aria-pressed={locale === 'en'}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={locale === 'ru' ? 'is-active' : ''}
              aria-pressed={locale === 'ru'}
              onClick={() => setLocale('ru')}
            >
              RU
            </button>
          </div>
        </div>
      </nav>

      <div className="stage">
        <header className="hero">
          <p className="hero__brand">worker-sync-db</p>
          <h1 className="hero__headline">{t.heroHeadline}</h1>
          <p className="hero__lede">{t.heroLede}</p>
          <div className="hero__cta">
            <a className="btn btn--primary" href="#swarm">
              {t.ctaWatchAgents}
            </a>
            <a className="btn btn--ghost" href={docsHome}>
              {t.ctaDocs}
            </a>
            <a
              className="btn btn--ghost"
              href="https://github.com/profyt/jubilant-journey"
              target="_blank"
              rel="noreferrer"
            >
              {t.navGitHub}
            </a>
          </div>
          <p className="hero__hint">{t.heroHint}</p>
        </header>

        <main id="playground" className="playground">
          <div className="playground__chrome">
            <div className="playground__head">
              <h2>{t.todosTitle}</h2>
              <p>{t.todosLede}</p>
            </div>

            <div className={`status ${pulse ? 'status--pulse' : ''}`}>
              <span
                className={`status__dot ${syncStatus?.online === false ? 'is-offline' : ''}`}
                title={
                  syncStatus?.online === false ? t.statusOffline : t.statusOnline
                }
              />
              <span>
                {t.statusPending}: {syncStatus?.pending ?? '—'}
              </span>
              {syncStatus?.lastSyncAt ? (
                <span>
                  {t.statusLastSync}:{' '}
                  {new Date(syncStatus.lastSyncAt).toLocaleTimeString(
                    locale === 'ru' ? 'ru-RU' : 'en-US',
                  )}
                </span>
              ) : (
                <span>{t.statusNotSynced}</span>
              )}
              {syncStatus?.lastError && (
                <span className="status__error">{syncStatus.lastError}</span>
              )}
              <button
                type="button"
                className="btn btn--small"
                onClick={() => void syncNow()}
              >
                {t.syncNow}
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
                placeholder={t.composerPlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading && todos.length === 0}
                aria-label={t.composerAria}
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!title.trim()}
              >
                {t.add}
              </button>
            </form>

            <div className="filters" role="tablist" aria-label={t.filterAria}>
              {(['all', 'open', 'done'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={filter === f ? 'is-active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="playground__list">
            {loading && todos.length === 0 ? (
              <p className="empty">{t.loading}</p>
            ) : todos.length === 0 ? (
              <p className="empty">{t.emptyTodos}</p>
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
                      aria-label={t.deleteAria(todo.title)}
                    >
                      {t.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>

      <ConflictPanel t={t} locale={locale} />

      <section id="swarm" className="swarm" aria-labelledby="swarm-title">
        <div className="swarm__intro">
          <h2 id="swarm-title">{t.swarmTitle}</h2>
          <p>{t.swarmLede}</p>
        </div>

        <div className="swarm__meter" aria-live="polite">
          <div className="swarm__stat">
            <span className="swarm__stat-label">{t.statEvents}</span>
            <span className="swarm__stat-value">{live.eventCount}</span>
          </div>
          <div className="swarm__stat">
            <span className="swarm__stat-label">{t.statOpen}</span>
            <span className="swarm__stat-value">{live.openCount}</span>
          </div>
          <div className="swarm__stat">
            <span className="swarm__stat-label">{t.statPending}</span>
            <span className="swarm__stat-value">
              {live.syncStatus?.pending ?? '—'}
            </span>
          </div>
          <div className="swarm__agents" aria-label={t.agentsAria}>
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
            {live.running ? t.pauseSwarm : t.resumeSwarm}
          </button>
        </div>

        {live.lastPulse && (
          <p className="swarm__pulse" key={live.lastPulse + live.eventCount}>
            {live.lastPulse}
          </p>
        )}

        <ol className="swarm__feed">
          {live.activityLoading && live.activities.length === 0 ? (
            <li className="swarm__feed-empty">{t.feedBooting}</li>
          ) : live.activities.length === 0 ? (
            <li className="swarm__feed-empty">{t.feedWaiting}</li>
          ) : (
            live.activities.map((row, index) => (
              <li
                key={row.id}
                className={`swarm__row swarm__row--${row.kind}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <time dateTime={new Date(row.at).toISOString()}>
                  {new Date(row.at).toLocaleTimeString(
                    locale === 'ru' ? 'ru-RU' : 'en-US',
                  )}
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
          {t.footer} <code>worker-sync-db</code>
        </span>
      </footer>
    </div>
  );
}
