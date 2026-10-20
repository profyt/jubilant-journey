import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useSubscribe } from 'worker-sync-db/react';
import type { ActivityDoc, TodoDoc } from './schema.js';
import { useDatabase } from './DatabaseProvider.js';
import { seedRemoteTodo } from '../sync/mockAdapter.js';
import { agentCopy, type Locale } from '../i18n.js';

export const AGENTS = [
  { id: 'nova', name: 'Nova', hue: '#7dd3c0' },
  { id: 'rio', name: 'Rio', hue: '#f0a202' },
  { id: 'kai', name: 'Kai', hue: '#9ec1ff' },
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

async function logActivity(
  db: NonNullable<ReturnType<typeof useDatabase>['db']>,
  agent: string,
  kind: ActivityDoc['kind'],
  message: string,
) {
  await db.put('activity', {
    id: crypto.randomUUID(),
    at: Date.now(),
    kind,
    agent,
    message,
  });
}

export function useLiveAgents(locale: Locale) {
  const { db, syncStatus } = useDatabase();
  const [running, setRunning] = useState(true);
  const [eventCount, setEventCount] = useState(0);
  const [lastPulse, setLastPulse] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const tickRef = useRef(0);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const { data: activityData, loading: activityLoading } = useQuery(db, 'activity');
  const { data: todoData } = useQuery(db, 'todos');

  useSubscribe(db, 'todos', () => {
    setEventCount((n) => n + 1);
  });
  useSubscribe(db, 'activity', (event) => {
    setEventCount((n) => n + 1);
    if (event.type === 'put' && event.doc) {
      const doc = event.doc as ActivityDoc;
      setLastPulse(`${doc.agent}: ${doc.message}`);
      setActiveAgent(doc.agent);
    }
  });

  const activities = (activityData as ActivityDoc[])
    .filter((d) => !d._deleted)
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  const openTodos = (todoData as TodoDoc[]).filter(
    (d) => !d._deleted && d.status === 'open',
  );

  const agentWrite = useCallback(async () => {
    if (!db) return;
    const copy = agentCopy[localeRef.current];
    const agent = pick(AGENTS);
    setActiveAgent(agent.name);
    const open = (await db.query('todos')).filter(
      (d) => !(d as TodoDoc)._deleted && (d as TodoDoc).status === 'open',
    ) as TodoDoc[];

    // Prefer toggles as the list grows so the demo stays readable.
    const toggleBias = open.length >= 8 ? 0.82 : open.length > 0 ? 0.5 : 0;
    if (open.length > 0 && Math.random() < toggleBias) {
      const todo = pick(open);
      await db.put('todos', {
        id: todo.id,
        title: todo.title,
        status: 'done',
        agent: agent.id,
      });
      await logActivity(
        db,
        agent.name,
        'agent_toggle',
        copy.completed(todo.title),
      );
      return;
    }

    const title = pick(copy.localTitles);
    await db.put('todos', {
      id: crypto.randomUUID(),
      title: `${agent.name}: ${title}`,
      status: 'open',
      agent: agent.id,
    });
    await logActivity(db, agent.name, 'agent_write', copy.added(title));
  }, [db]);

  const remoteTick = useCallback(async () => {
    if (!db) return;
    const copy = agentCopy[localeRef.current];
    const title = pick(copy.remoteTitles);
    seedRemoteTodo(title, 'orbit');
    const status = await db.syncNow();
    await logActivity(
      db,
      'Orbit',
      'remote_pull',
      copy.pulled(title, status.pending),
    );
  }, [db]);

  const syncTick = useCallback(async () => {
    if (!db) return;
    const copy = agentCopy[localeRef.current];
    const status = await db.syncNow();
    await logActivity(
      db,
      'Sync',
      'sync',
      status.lastError
        ? copy.syncError(status.lastError)
        : copy.flushed(status.pending),
    );
  }, [db]);

  useEffect(() => {
    if (!db || !running) return;

    let cancelled = false;
    const agentTimer = window.setInterval(() => {
      if (cancelled) return;
      tickRef.current += 1;
      void agentWrite();
    }, 2800);

    const syncTimer = window.setInterval(() => {
      if (cancelled) return;
      void syncTick();
    }, 5200);

    const remoteTimer = window.setInterval(() => {
      if (cancelled) return;
      void remoteTick();
    }, 7800);

    // Kick immediately so the section feels alive on first paint.
    void agentWrite();

    return () => {
      cancelled = true;
      window.clearInterval(agentTimer);
      window.clearInterval(syncTimer);
      window.clearInterval(remoteTimer);
    };
  }, [db, running, agentWrite, syncTick, remoteTick]);

  // Cap activity growth so IndexedDB stays demo-friendly.
  useEffect(() => {
    if (!db || activityData.length < 40) return;
    const stale = (activityData as ActivityDoc[])
      .filter((d) => !d._deleted)
      .sort((a, b) => a.at - b.at)
      .slice(0, activityData.length - 30);
    void Promise.all(stale.map((row) => db.delete('activity', row.id)));
  }, [db, activityData]);

  return {
    running,
    setRunning,
    activities,
    activityLoading,
    eventCount,
    lastPulse,
    activeAgent,
    openCount: openTodos.length,
    syncStatus,
    agentWrite,
    syncTick,
  };
}
