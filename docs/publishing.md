# Publishing to npm

## Checklist (ready to publish)

- [x] `name`, `version`, `description`, `license` (MIT + `LICENSE` file)
- [x] `exports` for `.`, `./react`, `./shared-worker`, `./dedicated-worker`
- [x] `types` / `main` / `module`, `sideEffects` for worker entries
- [x] `files`: `dist`, `LICENSE`, `README.md`, `CHANGELOG.md`
- [x] `engines.node` >= 18
- [x] `prepublishOnly`: typecheck + test + build
- [x] Dry-run pack verified (`npm run pack:dry`)

## Publish command

From a clean `main` with CI green and npm login configured:

```bash
npm run prepublishOnly
npm publish --access public
```

Optional tag check first:

```bash
npm pack --dry-run
npm publish --access public --dry-run
```

This environment does **not** run `npm publish` (no verified npm token). After publishing:

```bash
npm view worker-sync-db version
```

## Version bumps

Use semver. Update `CHANGELOG.md` before tagging `vX.Y.Z`.
