# Docs site (VitePress)

Public documentation for **worker-sync-db**, deployed to GitHub Pages together with the live demo.

## Local

```bash
# from repo root
npm run site:install
npm run docs:dev
```

Open the printed localhost URL (base path `/jubilant-journey/docs/` by default).

## Pages layout

| URL | Content |
|-----|---------|
| `/jubilant-journey/` | Live demo (`examples/vite-react-todos`) |
| `/jubilant-journey/docs/` | This VitePress site |

`DOCS_BASE` (default `/jubilant-journey/docs/`) and `DEMO_URL` (default `/jubilant-journey/`) must match the GitHub Pages project path.

Content is adapted from repo `docs/*.md` — keep API wording aligned when either side changes.
