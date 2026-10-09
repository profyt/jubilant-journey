# Marketing benchmarks

Committed outputs from `npm run bench:marketing` (real Chromium via Playwright).

| File | Contents |
|------|----------|
| [marketing-latest.json](./marketing-latest.json) | Full structured results + methodology |
| [marketing-snippet.md](./marketing-snippet.md) | Short markdown table (also injected into the root README) |

Regenerate after meaningful client/worker changes, on a quiet machine:

```bash
npm run example:install
npx playwright install chromium
npm run bench:marketing
```

CI runs `bench:marketing:ci` as **report-only** and does not overwrite these files.
