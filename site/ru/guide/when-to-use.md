# Когда выбирать worker-sync-db

Короткий гайд по сравнению с Dexie / `idb` / хостинговым sync. Это не «кто круче», а совпадение с вашей sync-плоскостью.

## Берите worker-sync-db, если нужно почти всё из списка

1. **Offline SPA / PWA-данные** в IndexedDB с TypeScript-типами из схемы
2. **Живые обновления во вкладках** через SharedWorker (без своего `BroadcastChannel`)
3. **Свой remote sync** — ваша auth, ретраи и API (`pull` / `push` или REST URL)
4. Опционально **React live queries** (`worker-sync-db/react`)

Смотрите [живое демо](https://profyt.github.io/jubilant-journey/) и [REST starter](https://profyt.github.io/jubilant-journey/starter/).

## Лучше Dexie (или похожее), если

- Хватает **CRUD в одной вкладке**, multi-tab SharedWorker sync не цель
- Уже есть **Dexie Cloud**, Firebase, Supabase realtime и т.п. как плоскость sync
- В первую очередь нужны **CRDT**, богатый query DSL или большая экосистема плагинов

## Жёсткие ограничения (не выдумывайте фичи)

- **Только браузер** — инициализация в `useEffect` / client entry; без SSR `createDatabase`
- Передавайте `sharedWorkerUrl` / `dedicatedWorkerUrl` (или дефолты пакета) — не используйте голый `new URL('worker-sync-db/…', import.meta.url)` в приложении
- Одинаковые `dbName` + `schema` на всех вкладках
- Safari / часть WebView: нет SharedWorker → dedicated fallback; по умолчанию `crossTabFallback: 'auto'` даёт BroadcastChannel для live `subscribe` (это не общий sync-leader). Смотрите `getWorkerMode()` / `getCrossTabTransport()` / `getDiagnostics()`
- Soft-delete; **LWW** по `_updatedAt` / `_version` (смотреть через `onConflict` — не CRDT)

## Установка

```bash
npm install worker-sync-db
```

Дальше: [Быстрый старт](./getting-started) · [Свой бэкенд](./sync) · [Архитектура](./architecture)
