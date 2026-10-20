# Draft: awesome-local-first listing

Prepared text for a careful PR/issue against community “awesome local-first” lists. **Do not spam** unrelated repos — only open when the maintainer guidelines fit, and prefer a single high-signal PR.

## Suggested one-liner

**[worker-sync-db](https://github.com/profyt/jubilant-journey)** — Offline-first IndexedDB for the browser with SharedWorker multi-tab live updates and bring-your-own push/pull sync (TypeScript, optional React hooks). [Docs](https://profyt.github.io/jubilant-journey/docs/) · [Demo](https://profyt.github.io/jubilant-journey/)

## Longer blurb (optional)

Browser-only local database: typed collections, soft deletes, last-write-wins sync to *your* API (delegate adapter or REST URLs). Not a hosted sync product and not a CRDT layer — choose it when multi-tab SharedWorker fan-out + BYO sync matter more than Dexie Cloud / Firebase lock-in.

## Checklist before opening an external PR

- [ ] Confirm the target list accepts IndexedDB / web libraries
- [ ] Match their formatting (bullets, categories, alphabetical rules)
- [ ] Link docs + demo; avoid marketing fluff
- [ ] One PR per list; wait for review — no drive-by spam

## npm

```bash
npm install worker-sync-db
```
