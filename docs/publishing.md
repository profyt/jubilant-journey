# Publishing (npmjs + GitHub Packages)

Dual publish keeps the **public npm name** stable while also listing the package on this repo’s **Packages** tab.

| Registry | Package name | Audience |
|----------|--------------|----------|
| [registry.npmjs.org](https://www.npmjs.com/package/worker-sync-db) | `worker-sync-db` (unscoped) | Primary install path for apps |
| [GitHub Packages](https://github.com/profyt/jubilant-journey/pkgs/npm/worker-sync-db) | `@profyt/worker-sync-db` | Same tarball, scoped for `npm.pkg.github.com` |

GitHub Packages expects an owner-scoped name (`@profyt/...`). Unscoped names are not the supported path there, so CI **renames only for the GitHub publish step** and never commits that rename. Source `package.json` stays `worker-sync-db`.

The published `package.json` on both registries includes:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/profyt/jubilant-journey.git"
}
```

That `repository` field is what links the GitHub Packages entry to this repo (Packages UI / “connected repository”).

## Checklist (ready to publish)

- [x] `name`, `version`, `description`, `license` (MIT + `LICENSE` file)
- [x] `exports` for `.`, `./react`, `./shared-worker`, `./dedicated-worker`
- [x] `types` / `main` / `module`, `sideEffects` for worker entries
- [x] `files`: `dist`, `LICENSE`, `README.md`, `CHANGELOG.md`
- [x] `engines.node` >= 18
- [x] `repository` / `bugs` / `homepage` pointing at this GitHub repo
- [x] `prepublishOnly`: typecheck + test + build (local / manual publish)
- [x] CI workflow [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) dual-publishes on tag / dispatch
- [x] Dry-run pack verified (`npm run pack:dry`)

## Automated dual publish (preferred)

Workflow: **Publish** (`.github/workflows/publish.yml`).

**Triggers**

- Push of a version tag `v*` (e.g. `v0.1.1`) — tag must match `package.json` `version`
- Manual **Actions → Publish → Run workflow** (`workflow_dispatch`), optional **dry_run**

**What it does**

1. `npm ci` → typecheck → test → build
2. Publishes `worker-sync-db` to `https://registry.npmjs.org` with `NPM_TOKEN`
3. Sets `name` to `@profyt/worker-sync-db` in the job workspace only
4. Publishes to `https://npm.pkg.github.com` with `GITHUB_TOKEN` (`packages: write`)

**Secrets / permissions**

| Secret / permission | Used for |
|---------------------|----------|
| Repository secret `NPM_TOKEN` | Publish to npmjs.org |
| Job `GITHUB_TOKEN` + `packages: write` | Publish to GitHub Packages (no extra secret) |

Create `NPM_TOKEN` on npmjs as an **automation** or **granular** access token that can publish `worker-sync-db` and **bypass 2FA / OTP** (account OTP cannot be entered from Actions). Add it under **Settings → Secrets and variables → Actions → `NPM_TOKEN`**.

After the first successful GitHub Packages publish, open the repo **Packages** tab (or the package URL above). If the package is not linked yet, use the package settings **Connect repository** and select `profyt/jubilant-journey` (normally automatic when `repository` is set).

### Release steps

1. Bump `version` in `package.json` (semver) and update `CHANGELOG.md`
2. Merge to `main`, wait for CI green
3. Tag and push:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Or create a GitHub Release from that tag (the workflow listens to the tag push).

4. Confirm:

```bash
npm view worker-sync-db version
# GitHub Packages (auth required):
npm view @profyt/worker-sync-db version --registry=https://npm.pkg.github.com
```

Dry-run without uploading: **Actions → Publish → Run workflow → dry_run = true**.

## Manual publish (local)

From a clean `main` with npm login configured (Automation token recommended so OTP is not required):

```bash
npm run prepublishOnly
npm publish --access public
```

Optional checks:

```bash
npm pack --dry-run
npm publish --access public --dry-run
```

GitHub Packages from a laptop (scoped name + registry map):

```bash
# after a successful local npmjs publish of the same version:
npm pkg set name='@profyt/worker-sync-db'
# ~/.npmrc (do not commit tokens):
# //npm.pkg.github.com/:_authToken=YOUR_GH_PAT
# @profyt:registry=https://npm.pkg.github.com
npm publish --access public --registry=https://npm.pkg.github.com
git checkout -- package.json   # restore unscoped name
```

Prefer the GitHub Action over local dual publish so the rename never lands on `main`.

## Install from each registry

### npmjs (default for apps)

```bash
npm install worker-sync-db
```

```ts
import { createDatabase, defineSchema } from 'worker-sync-db';
```

### GitHub Packages

Project `.npmrc` (map only the `@profyt` scope; leave the default registry for everything else):

```ini
@profyt:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use a GitHub PAT (or `GITHUB_TOKEN` in Actions) with `read:packages`. Then:

```bash
npm install @profyt/worker-sync-db
```

```ts
import { createDatabase, defineSchema } from '@profyt/worker-sync-db';
```

Import paths (`worker-sync-db/react`, workers, etc.) use the **installed package name** as the prefix — with GitHub Packages that prefix is `@profyt/worker-sync-db/...`.

## Version bumps

Use semver. Update `CHANGELOG.md` before tagging `vX.Y.Z`. Do not re-publish an existing version to either registry.
