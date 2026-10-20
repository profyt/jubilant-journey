export type Locale = 'en' | 'ru';

const STORAGE_KEY = 'wsd-demo-locale';

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ru') return stored;
  } catch {
    /* ignore quota / private mode */
  }
  const lang = window.navigator.language || '';
  return /^ru\b/i.test(lang) ? 'ru' : 'en';
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export type Messages = {
  navAria: string;
  navDocs: string;
  navExamples: string;
  navDemo: string;
  navGitHub: string;
  langSwitcherAria: string;
  heroHeadline: string;
  heroLede: string;
  ctaWatchAgents: string;
  ctaDocs: string;
  heroHint: string;
  todosTitle: string;
  todosLede: string;
  statusPending: string;
  statusLastSync: string;
  statusNotSynced: string;
  statusOnline: string;
  statusOffline: string;
  syncNow: string;
  composerPlaceholder: string;
  composerAria: string;
  add: string;
  filterAria: string;
  filterAll: string;
  filterOpen: string;
  filterDone: string;
  loading: string;
  emptyTodos: string;
  remove: string;
  deleteAria: (title: string) => string;
  swarmTitle: string;
  swarmLede: string;
  statEvents: string;
  statOpen: string;
  statPending: string;
  agentsAria: string;
  pauseSwarm: string;
  resumeSwarm: string;
  feedBooting: string;
  feedWaiting: string;
  conflictTitle: string;
  conflictLede: string;
  conflictEmpty: string;
  conflictDemoRemote: string;
  conflictDemoLocal: string;
  conflictDemoPush: string;
  conflictClear: string;
  conflictDiscardFailed: string;
  conflictFailed: string;
  conflictPushLabel: string;
  conflictLwwLabel: string;
  conflictOutcomeRemote: string;
  conflictOutcomeLocal: string;
  footer: string;
  bootTitle: string;
  bootHint: string;
  metaDescription: string;
  pageTitle: string;
};

const en: Messages = {
  navAria: 'Site',
  navDocs: 'Docs',
  navExamples: 'Examples',
  navDemo: 'Demo',
  navGitHub: 'GitHub',
  langSwitcherAria: 'Language',
  heroHeadline: 'One database. Every tab. Offline-first.',
  heroLede:
    'Edits save in a SharedWorker, every open tab stays in sync, and a mock remote adapter shows push/pull without leaving the page.',
  ctaWatchAgents: 'Watch live agents',
  ctaDocs: 'Documentation',
  heroHint:
    'Tip: open this URL in a second tab — adds and toggles mirror instantly.',
  todosTitle: 'Live todos',
  todosLede:
    'Add or complete tasks — they persist offline. Agents below also write here through the same worker DB.',
  statusPending: 'Pending',
  statusLastSync: 'Last sync',
  statusNotSynced: 'Not synced yet',
  statusOnline: 'Online',
  statusOffline: 'Offline',
  syncNow: 'Sync now',
  composerPlaceholder: 'What should stay in sync?',
  composerAria: 'New todo title',
  add: 'Add',
  filterAria: 'Filter todos',
  filterAll: 'all',
  filterOpen: 'open',
  filterDone: 'done',
  loading: 'Loading…',
  emptyTodos: 'No todos yet — add one, or let agents start writing.',
  remove: 'Remove',
  deleteAria: (title) => `Delete ${title}`,
  swarmTitle: 'Sync swarm',
  swarmLede:
    'Simulated peers write through the real SharedWorker database, flush the mock remote on a timer, and pull seeded server changes — watch the activity stream move without clicking.',
  statEvents: 'Live events',
  statOpen: 'Open todos',
  statPending: 'Pending sync',
  agentsAria: 'Agents',
  pauseSwarm: 'Pause swarm',
  resumeSwarm: 'Resume swarm',
  feedBooting: 'Booting agent stream…',
  feedWaiting: 'Waiting for the first write…',
  conflictTitle: 'Conflicts & LWW',
  conflictLede:
    'onConflict is inspect-only — default merge stays last-write-wins. Trigger demos below to see push rejections and pull LWW outcomes in the feed.',
  conflictEmpty: 'No conflict events yet — run a demo action.',
  conflictDemoRemote: 'Demo remote wins',
  conflictDemoLocal: 'Demo local wins',
  conflictDemoPush: 'Demo push conflict',
  conflictClear: 'Clear log',
  conflictDiscardFailed: 'Discard failed ops',
  conflictFailed: 'Failed ops',
  conflictPushLabel: 'push',
  conflictLwwLabel: 'lww',
  conflictOutcomeRemote: 'remote-applied',
  conflictOutcomeLocal: 'local-wins',
  footer: 'MIT · npm package',
  bootTitle: 'Could not start the local database',
  bootHint: 'If you run from source, build the library at the repo root:',
  metaDescription:
    'Live demo of worker-sync-db — offline todos with multi-tab sync and optional server sync.',
  pageTitle: 'worker-sync-db — live demo',
};

const ru: Messages = {
  navAria: 'Навигация',
  navDocs: 'Документация',
  navExamples: 'Примеры',
  navDemo: 'Демо',
  navGitHub: 'GitHub',
  langSwitcherAria: 'Язык',
  heroHeadline: 'Одна база. Все вкладки. Offline-first.',
  heroLede:
    'Правки сохраняются в SharedWorker, открытые вкладки остаются синхронизированными, а mock-адаптер показывает push/pull прямо на странице.',
  ctaWatchAgents: 'Смотреть агентов',
  ctaDocs: 'Документация',
  heroHint:
    'Совет: откройте эту страницу во второй вкладке — добавления и переключения появятся сразу.',
  todosTitle: 'Живые todos',
  todosLede:
    'Добавляйте и отмечайте задачи — они сохраняются offline. Агенты ниже тоже пишут сюда через ту же worker-базу.',
  statusPending: 'В очереди',
  statusLastSync: 'Последний sync',
  statusNotSynced: 'Ещё не синхронизировали',
  statusOnline: 'Онлайн',
  statusOffline: 'Офлайн',
  syncNow: 'Синхронизировать',
  composerPlaceholder: 'Что должно остаться в sync?',
  composerAria: 'Название нового todo',
  add: 'Добавить',
  filterAria: 'Фильтр todos',
  filterAll: 'все',
  filterOpen: 'открытые',
  filterDone: 'готово',
  loading: 'Загрузка…',
  emptyTodos: 'Пока нет todos — добавьте сами или дождитесь агентов.',
  remove: 'Удалить',
  deleteAria: (title) => `Удалить ${title}`,
  swarmTitle: 'Рой sync',
  swarmLede:
    'Имитация пиров пишет через настоящую SharedWorker-базу, по таймеру сбрасывает mock remote и тянет seeded-изменения с сервера — лента активности идёт сама, без кликов.',
  statEvents: 'События',
  statOpen: 'Открытые',
  statPending: 'В очереди sync',
  agentsAria: 'Агенты',
  pauseSwarm: 'Пауза',
  resumeSwarm: 'Продолжить',
  feedBooting: 'Запуск потока агентов…',
  feedWaiting: 'Ждём первую запись…',
  conflictTitle: 'Конфликты и LWW',
  conflictLede:
    'onConflict только для наблюдения — стратегия по умолчанию остаётся last-write-wins. Кнопки ниже показывают отказ push и исходы LWW на pull.',
  conflictEmpty: 'Пока нет событий — запустите демо-действие.',
  conflictDemoRemote: 'Демо: победил remote',
  conflictDemoLocal: 'Демо: победил local',
  conflictDemoPush: 'Демо: конфликт push',
  conflictClear: 'Очистить лог',
  conflictDiscardFailed: 'Сбросить failed ops',
  conflictFailed: 'Failed ops',
  conflictPushLabel: 'push',
  conflictLwwLabel: 'lww',
  conflictOutcomeRemote: 'remote-applied',
  conflictOutcomeLocal: 'local-wins',
  footer: 'MIT · npm-пакет',
  bootTitle: 'Не удалось запустить локальную базу',
  bootHint: 'Если запускаете из исходников, соберите библиотеку в корне репозитория:',
  metaDescription:
    'Живое демо worker-sync-db — offline todos, sync между вкладками и опциональная синхронизация с сервером.',
  pageTitle: 'worker-sync-db — живое демо',
};

export const messages: Record<Locale, Messages> = { en, ru };

export type AgentCopy = {
  remoteTitles: readonly string[];
  localTitles: readonly string[];
  completed: (title: string) => string;
  added: (title: string) => string;
  pulled: (title: string, pending: number) => string;
  syncError: (error: string) => string;
  flushed: (pending: number) => string;
};

const agentEn: AgentCopy = {
  remoteTitles: [
    'Ship changelog snippet',
    'Reconcile offline queue',
    'Warm SharedWorker cache',
    'Index pending sync ops',
    'Replay conflict resolution',
  ],
  localTitles: [
    'Draft release notes',
    'Probe multi-tab fan-out',
    'Trim stale activity rows',
    'Benchmark put latency',
    'Verify soft-delete path',
    'Pulse sync adapter',
  ],
  completed: (title) => `completed “${title}”`,
  added: (title) => `added “${title}”`,
  pulled: (title, pending) => `pulled remote “${title}” · pending ${pending}`,
  syncError: (error) => `error: ${error}`,
  flushed: (pending) => `flushed · pending ${pending}`,
};

const agentRu: AgentCopy = {
  remoteTitles: [
    'Отрывок changelog',
    'Сверка offline-очереди',
    'Прогрев кэша SharedWorker',
    'Индекс pending sync-операций',
    'Повтор разрешения конфликта',
  ],
  localTitles: [
    'Черновик release notes',
    'Проверка multi-tab fan-out',
    'Чистка устаревших activity',
    'Бенчмарк latency put',
    'Проверка soft-delete',
    'Пульс sync-адаптера',
  ],
  completed: (title) => `завершил «${title}»`,
  added: (title) => `добавил «${title}»`,
  pulled: (title, pending) =>
    `подтянул remote «${title}» · в очереди ${pending}`,
  syncError: (error) => `ошибка: ${error}`,
  flushed: (pending) => `сбросил · в очереди ${pending}`,
};

export const agentCopy: Record<Locale, AgentCopy> = {
  en: agentEn,
  ru: agentRu,
};
