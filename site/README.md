# Docs site (VitePress)

Public documentation for **worker-sync-db**, deployed to GitHub Pages together with the live demo.

## Local

```bash
# from repo root
npm run site:install
npm run docs:dev
```

Open the printed localhost URL (base path `/jubilant-journey/docs/` by default).

## Locales

| Locale | Path under `site/` | URL on Pages |
|--------|--------------------|--------------|
| English (default) | `index.md`, `guide/`, `examples/` | `/jubilant-journey/docs/` |
| Russian | `ru/index.md`, `ru/guide/`, `ru/examples/` | `/jubilant-journey/docs/ru/` |

Switch language with the VitePress locale menu in the docs navbar (English / Русский).

## Pages layout

| URL | Content |
|-----|---------|
| `/jubilant-journey/` | Live demo (`examples/vite-react-todos`) |
| `/jubilant-journey/docs/` | Docs (English) |
| `/jubilant-journey/docs/ru/` | Docs (Russian) |

`DOCS_BASE` (default `/jubilant-journey/docs/`) and `DEMO_URL` (default absolute Pages demo URL) must match the GitHub Pages project path.

Content is adapted from repo `docs/*.md` — keep API wording aligned when either side changes. Russian pages live under `site/ru/` and mirror the English tree.

Agent crawler files `llms.txt` / `llms-full.txt` live at the **repo root** and are copied to the Pages root (and `/docs/`) by `.github/workflows/pages.yml`.
