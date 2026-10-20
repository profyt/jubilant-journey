import { useState } from 'react';
import type { Conflict } from 'worker-sync-db';
import { useConflictLog } from './db/ConflictLog.js';
import { useDatabase } from './db/DatabaseProvider.js';
import type { TodoDoc } from './db/schema.js';
import type { Messages } from './i18n.js';
import {
  armPushConflictDemo,
  seedRemoteRevision,
} from './sync/mockAdapter.js';

function formatConflict(conflict: Conflict, t: Messages): string {
  if (conflict.kind === 'push') {
    return `${t.conflictPushLabel} · ${conflict.opId.slice(0, 8)}… · ${conflict.reason}`;
  }
  const outcome =
    conflict.outcome === 'remote-applied'
      ? t.conflictOutcomeRemote
      : t.conflictOutcomeLocal;
  return `${t.conflictLwwLabel} · ${conflict.collection}/${conflict.id} · ${outcome}`;
}

export function ConflictPanel({
  t,
  locale,
}: {
  t: Messages;
  locale: 'en' | 'ru';
}) {
  const { db, syncStatus } = useDatabase();
  const { entries, clear } = useConflictLog();
  const [busy, setBusy] = useState(false);

  async function ensureDemoTodo(): Promise<TodoDoc> {
    if (!db) throw new Error('db not ready');
    const existing = ((await db.query('todos')) as TodoDoc[]).find(
      (d) => !d._deleted && d.id.startsWith('conflict-demo-'),
    );
    if (existing) return existing;
    return (await db.put('todos', {
      id: 'conflict-demo-item',
      title:
        locale === 'ru' ? 'Документ для демо LWW' : 'LWW conflict demo doc',
      status: 'open',
      agent: 'demo',
    })) as TodoDoc;
  }

  async function runLww(remoteWins: boolean) {
    if (!db || busy) return;
    setBusy(true);
    try {
      const local = await ensureDemoTodo();
      seedRemoteRevision({
        id: local.id,
        title: remoteWins
          ? locale === 'ru'
            ? 'Версия с сервера (новее)'
            : 'Remote revision (newer)'
          : locale === 'ru'
            ? 'Устаревшая версия с сервера'
            : 'Stale remote revision',
        remoteWins,
        localUpdatedAt: local._updatedAt,
        localVersion: local._version,
      });
      await db.syncNow();
    } finally {
      setBusy(false);
    }
  }

  async function runPushConflict() {
    if (!db || busy) return;
    setBusy(true);
    try {
      await db.put('todos', {
        id: `push-conflict-${Date.now()}`,
        title:
          locale === 'ru' ? 'Документ для демо push' : 'Push conflict demo doc',
        status: 'open',
        agent: 'demo',
      });
      armPushConflictDemo();
      await db.syncNow();
    } finally {
      setBusy(false);
    }
  }

  async function discardFailed() {
    if (!db || busy) return;
    setBusy(true);
    try {
      await db.discardFailedOps();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="conflicts" className="conflicts" aria-labelledby="conflicts-title">
      <div className="conflicts__intro">
        <h2 id="conflicts-title">{t.conflictTitle}</h2>
        <p>{t.conflictLede}</p>
      </div>

      <div className="conflicts__actions">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy || !db}
          onClick={() => void runLww(true)}
        >
          {t.conflictDemoRemote}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy || !db}
          onClick={() => void runLww(false)}
        >
          {t.conflictDemoLocal}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy || !db}
          onClick={() => void runPushConflict()}
        >
          {t.conflictDemoPush}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy || !db || !(syncStatus?.failed)}
          onClick={() => void discardFailed()}
        >
          {t.conflictDiscardFailed}
          {typeof syncStatus?.failed === 'number'
            ? ` (${syncStatus.failed})`
            : ''}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={entries.length === 0}
          onClick={clear}
        >
          {t.conflictClear}
        </button>
      </div>

      {typeof syncStatus?.failed === 'number' && syncStatus.failed > 0 && (
        <p className="conflicts__failed">
          {t.conflictFailed}: {syncStatus.failed}
        </p>
      )}

      <ol className="conflicts__feed">
        {entries.length === 0 ? (
          <li className="conflicts__empty">{t.conflictEmpty}</li>
        ) : (
          entries.map((row) => (
            <li
              key={row.id}
              className={`conflicts__row conflicts__row--${row.conflict.kind}`}
            >
              <time dateTime={new Date(row.at).toISOString()}>
                {new Date(row.at).toLocaleTimeString(
                  locale === 'ru' ? 'ru-RU' : 'en-US',
                )}
              </time>
              <span className="conflicts__kind">
                {row.conflict.kind === 'push'
                  ? t.conflictPushLabel
                  : t.conflictLwwLabel}
              </span>
              <span className="conflicts__msg">
                {formatConflict(row.conflict, t)}
              </span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
