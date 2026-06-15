# Release Checklist (tsfulmen)

tsfulmen is a TypeScript library: releases are **npm packages** published to `@fulmenhq/tsfulmen` on npmjs.com,
plus git tags for version tracking.

This checklist follows the shared ecosystem pattern (gofulmen/pyfulmen/tsfulmen/rsfulmen) codified in Crucible.

> **Detailed Steps**: See [docs/publishing.md](docs/publishing.md) for expanded instructions on each step.

## Release Automation

Starting with v0.2.4, releases are **fully automated** via GitHub Actions. The only manual steps are pre-tag verification and pushing the signed tag — everything after that is hands-off:

1. **You do**: Pre-release checks, dry-run verification, create and push signed tag
2. **Automated**: Quality gates run in CI
3. **Automated**: npm package published via OIDC trusted publishing
4. **Automated**: GitHub release created with artifacts and checksums
5. **Automated**: Post-release package verification
6. **You do**: Approve the `publish-npm` deployment when prompted, verify npm publication

**No manual npm publish, artifact upload, or release creation required.** The workflow handles everything after you push the signed tag.

## Prerequisites (First Time Setup)

### 1. GitHub Environment

Create `publish-npm` environment in repository settings:

- **Environment name**: `publish-npm`
- **Required reviewers**: 1 (maintainer)
- **Wait timer**: 0 minutes
- **Deployment branches/tags**: Selected branches and tags
- **Pattern**: `v*` (glob pattern - matches all tags starting with 'v')

This matches: `v0.2.4`, `v0.2.4-rc1`, `v0.2.4-beta.2`

**Note**: GitHub uses glob patterns, not regex. `v*` is the reliable choice.

### 2. npm Trusted Publisher

Navigate to: `https://www.npmjs.com/package/@fulmenhq/tsfulmen/access`

1. Find **Trusted Publisher** section
2. Click **GitHub Actions**
3. Configure:
   - **Organization**: `fulmenhq` (case-sensitive)
   - **Repository**: `tsfulmen`
   - **Workflow filename**: `release.yml`
   - **Environment name**: `publish-npm`
4. Click **Set up connection**

### 3. Remove NPM_TOKEN Secrets

**CRITICAL**: Remove any `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets from:

- Repository secrets (Settings → Secrets and variables → Actions)
- Environment secrets
- Organization secrets

npm will use token auth if any token is present, even with OIDC configured.

## Pre-Release (DO NOT SKIP)

- [ ] `git status` is clean (no uncommitted changes)
- [ ] `make sync-ssot` completed and provenance reviewed:
  - [ ] `.goneat/ssot/provenance.json` is present/current
  - [ ] `.crucible/metadata/metadata.yaml` is present/current
- [ ] Quality gates pass:
  ```bash
  make check-all
  ```
- [ ] `CHANGELOG.md` updated (Unreleased section → new version section)
- [ ] `RELEASE_NOTES.md` updated with release summary
- [ ] `docs/releases/v{VERSION}.md` created with release details
- [ ] `VERSION` file contains the intended version (no `v` prefix)
- [ ] Version propagated to all files:
  ```bash
  make version-sync
  ```
- [ ] Verify version consistency:
  ```bash
  cat VERSION
  grep '"version"' package.json
  grep "VERSION = " src/index.ts
  ```

## Dry-Run Verification (CRITICAL - Prevents Burning Tags)

These steps MUST pass before creating any tags. Run Steps 1-4 here, then proceed to Tagging (which includes `npm publish --dry-run` as Step 5 — it requires the local tag to exist).

### Step 1: Build + Artifact Verification

> **Build first.** `verify-artifacts` compares the **built/exported** version (in `dist/`) against `package.json`. After a version bump, `dist/` is stale and the check fails with `VERSION mismatch: package.json=X, exported=Y` — and `make check-all` does **not** build. Always rebuild before verifying. (CI's release workflow already builds; this only bites local dry-runs.)

```bash
make build
make verify-artifacts
```

Expected: `✅ All artifact verification checks PASSED`

### Step 2: Local Install Test

```bash
make verify-local-install
```

Expected: `✅ Package verified - Safe to publish`

**Why**: Catches path resolution bugs that only appear in installed packages (prevented v0.1.9 regression).

### Step 3: Compiled-Binary Smoke Test

```bash
make verify-compile-smoke
```

Expected: `✅ COMPILE SMOKE PASSED (4/4)`

**Why**: Catches `bun build --compile` regressions — CLI shadowing and string-metrics WASM `ENOENT` — that only manifest in compiled consumer binaries. Both shipped silently in v0.3.0 because nothing exercised the `--compile` path.

### Step 4: Final Status Check

```bash
git status
```

Must be clean. If version-sync created changes, commit them first.

## Tagging and Release

> **WARNING**: Once a tag is pushed and the workflow publishes to npm, the version is burned.
> npm packages cannot be unpublished (only deprecated). Do not proceed until ALL dry-run steps pass.

### Step 1: Prepare GPG

```bash
export GPG_TTY="$(tty)"
gpg-connect-agent updatestartuptty /bye
```

### Step 2: Run Guard Check

```bash
make release-guard-tag-version
```

### Step 3: Create Signed Tag (local only)

Create the tag locally but **do not push yet** — run dry-run verification first.

```bash
make release-tag
```

Or manually:

```bash
git tag -s "v$(cat VERSION)" -m "Release v$(cat VERSION)"
```

### Step 4: Verify Tag Locally

```bash
make release-verify-tag
# or manually:
git verify-tag "v$(cat VERSION)"
```

### Step 5: npm Dry-Run (requires local tag)

Now that the local tag exists, run the dry-run to validate prepublishOnly hooks:

```bash
npm publish --dry-run
```

Review the package contents listing. Resolve any failures before proceeding. If fixes are needed, delete the local tag, fix, re-commit, and re-tag.

### Step 6: Push Main and Tag

```bash
git push origin main
git push origin "v$(cat VERSION)"
```

> **Point of no return**: Once the tag is pushed, the automated release pipeline takes over.
> Steps 7-8 below are for monitoring the automation — not manual actions.

### Step 7: Approve Deployment (manual gate)

The workflow will pause at the `publish-npm` environment. **You must approve it in the GitHub UI:**

1. Go to: https://github.com/fulmenhq/tsfulmen/actions/workflows/release.yml
2. Find the running workflow for your tag
3. Click "Review deployments"
4. Click "Approve and deploy"

### Step 8: Monitor Workflow

The following jobs run automatically after approval:

| Job | What it does | Manual action needed |
|-----|-------------|---------------------|
| Validate | Verifies tag matches VERSION | None |
| Publish-npm | Publishes to npm via OIDC | Approve deployment (Step 7) |
| Build-artifacts | Creates release artifacts (.tgz, checksums) | None |
| Release | Creates GitHub release with artifacts | None |
| Verify | Tests npm package installation | None |

## Post-Release Verification

> These steps are **automated by the release workflow**. The commands below are for manual
> verification if needed, or if you want to confirm the automation succeeded.

### Step 1: Verify npm Package

The workflow's Verify job does this automatically. To confirm manually:

```bash
npm view @fulmenhq/tsfulmen versions --json | tail -5
```

### Step 2: Verify Published Package Works

The workflow runs package smoke tests. To verify manually:

```bash
make verify-published-package
# or with explicit version:
VERIFY_PUBLISH_VERSION=$(cat VERSION) make verify-published-package
```

Expected: `✅ Package verification PASSED`

### Step 3: Review GitHub Release

1. Go to: https://github.com/fulmenhq/tsfulmen/releases
2. Confirm the release for your version is published (the workflow creates it automatically via `gh release create`)
3. Verify:
   - [ ] Release notes are present
   - [ ] Artifacts attached (.tgz, SHA256SUMS, SHA512SUMS)

## Troubleshooting

### Workflow Failed Before npm Publish

If the workflow fails during validation or build:

```bash
# Delete the tag
git push origin --delete "v$(cat VERSION)"
git tag -d "v$(cat VERSION)"

# Fix the issue on main
git add <files>
git commit -m "fix: <description>"
git push origin main

# Re-create and push tag
make release-tag
git push origin "v$(cat VERSION)"
```

### Workflow Failed After npm Publish

**⚠️ CRITICAL**: npm packages cannot be unpublished! You must:

1. Deprecate the bad version:

   ```bash
   npm deprecate "@fulmenhq/tsfulmen@$(cat VERSION)" "Critical bug - use $(cat VERSION | awk -F. '{$3=$3+1; print}' OFS='.')"
   ```

2. Bump version and release again:
   ```bash
   echo "X.Y.Z+1" > VERSION
   make version-sync
   git add VERSION package.json src/index.ts src/__tests__/index.test.ts
   git commit -m "chore: bump to vX.Y.Z+1 (fix release issue)"
   git push origin main
   make release-tag
   git push origin "v$(cat VERSION)"
   ```

### GPG pinentry dialog not appearing

If the GPG passphrase dialog doesn't appear:

```bash
gpgconf --kill gpg-agent
export GPG_TTY=$(tty)
gpg-connect-agent updatestartuptty /bye
make release-tag
```

### OIDC Publishing Fails

If npm publish fails with "Access token expired or revoked":

1. Check npm CLI version in workflow (must be 11.5.1+)
2. Verify no NPM_TOKEN secrets exist in repo/environment
3. Check trusted publisher configuration on npmjs.com
4. Ensure workflow filename matches exactly (`release.yml`)

See [docs/knowledge/cicd/registry/npm-oidc.md](docs/knowledge/cicd/registry/npm-oidc.md) for full troubleshooting.

## Cross-References

- [Publishing Guide](docs/publishing.md) - Detailed step-by-step instructions
- [Release Notes](RELEASE_NOTES.md) - Current and recent release summaries
- [Changelog](CHANGELOG.md) - Full version history
- [rsfulmen RELEASE_CHECKLIST.md](https://github.com/fulmenhq/rsfulmen/blob/main/RELEASE_CHECKLIST.md) - Signed tag reference implementation
- [Crucible OIDC Knowledge](docs/knowledge/cicd/registry/npm-oidc.md) - OIDC troubleshooting
