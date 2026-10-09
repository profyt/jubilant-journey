# Docs site (VitePress)

Public documentation for **worker-sync-db**, deployed to GitHub Pages together with the live demo.

## Local

```bash
# from repo root
npm run site:install
npm run docs:dev
```

Open the printed localhost URL. Demo links (`/demo/`) resolve after a Pages-style assemble (see workflow); during `docs:dev` they 404 unless you copy the demo build into `.vitepress/dist/demo` after `docs:build`.

## Pages layout

| URL | Content |
|-----|---------|
| `/jubilant-journey/` | This VitePress site |
| `/jubilant-journey/demo/` | `examples/vite-react-todos` |

`DOCS_BASE` (default `/jubilant-journey/`) must match the GitHub Pages project path.

Content is adapted from repo `docs/*.md` — keep API wording aligned when either side changes.
