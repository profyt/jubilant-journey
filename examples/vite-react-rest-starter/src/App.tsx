import { useEffect, useState, type FormEvent } from 'react';
import {
  DatabaseProvider,
  useQuery,
  useSyncStatus,
} from 'worker-sync-db/react';
import {
  AUTH_TOKEN,
  openStarterDb,
  usesStaticMock,
  type StarterDb,
} from './db/client.js';

function NotesPanel({ db }: { db: StarterDb }) {
  // Prefer context forms so hooks stay covariant with the schema.
  const { data: notes } = useQuery('notes');
  const sync = useSyncStatus();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const base = import.meta.env.BASE_URL;
  const siteRoot =
    base === '/' || base === './'
      ? 'https://profyt.github.io/jubilant-journey/'
      : base.replace(/starter\/?$/, '');
  const demoHome = siteRoot;
  const docsHome = `${siteRoot}docs/`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await db.put('notes', {
        id: crypto.randomUUID(),
        title: trimmed,
      });
      setTitle('');
      await db.syncNow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="panel">
      <header>
        <p className="eyebrow">worker-sync-db</p>
        <h1>REST starter</h1>
        <p className="lede">
          Offline IndexedDB notes with{' '}
          {usesStaticMock ? (
            <>
              an in-memory mock sync (Pages build). Locally, run the starter with
              Vite middleware for fetch +{' '}
              <code>Authorization: Bearer {AUTH_TOKEN}</code>.
            </>
          ) : (
            <>
              fetch sync + <code>Authorization: Bearer {AUTH_TOKEN}</code>.
            </>
          )}{' '}
          Open a second tab to see live updates.
        </p>
        <p className="nav-links">
          <a href={demoHome}>Live todos demo</a>
          {' · '}
          <a href={docsHome}>Docs</a>
          {' · '}
          <a
            href="https://github.com/profyt/jubilant-journey/tree/main/examples/vite-react-rest-starter"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </p>
      </header>

      <form className="row" onSubmit={onSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New note"
          aria-label="New note"
        />
        <button type="submit" disabled={busy}>
          Add + sync
        </button>
      </form>

      <p className="status" aria-live="polite">
        pending={sync?.pending ?? '…'} online={String(sync?.online ?? '…')}
        {sync?.lastError ? ` error=${sync.lastError}` : ''}
      </p>

      <ul className="list">
        {notes.map((n) => (
          <li key={String(n.id)}>
            <span>{String(n.title)}</span>
            <button
              type="button"
              className="ghost"
              onClick={() => void db.delete('notes', String(n.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function App() {
  const [db, setDb] = useState<StarterDb | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let closed = false;
    let client: StarterDb | null = null;
    void openStarterDb()
      .then((opened) => {
        if (closed) {
          opened.close();
          return;
        }
        client = opened;
        setDb(opened);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      closed = true;
      client?.close();
    };
  }, []);

  if (error) {
    return <p className="err">Failed to open DB: {error}</p>;
  }
  if (!db) {
    return <p className="status">Booting…</p>;
  }

  return (
    <DatabaseProvider db={db}>
      <NotesPanel db={db} />
    </DatabaseProvider>
  );
}
