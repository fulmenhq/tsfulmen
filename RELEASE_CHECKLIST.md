# Release Checklist (tsfulmen)

tsfulmen is a TypeScript library: releases are **npm packages** published to `@fulmenhq/tsfulmen` on npmjs.com,
plus git tags for version tracking.

This checklist follows the shared ecosystem pattern (gofulmen/pyfulmen/tsfulmen/rsfulmen) codified in Crucible.

> **Detailed Steps**: See [docs/publishing.md](docs/publishing.md) for expanded instructions on each step.

## Release Automation

Starting with v0.2.4, releases are **fully automated** via GitHub Actions:

1. Push signed tag → Workflow triggers
2. Quality gates run
3. npm package published via OIDC trusted publishing
4. GitHub release created with artifacts
5. Post-release verification

**No manual npm publish required!** The workflow handles everything after you push the signed tag.

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

These steps MUST pass before creating any tags.

### Step 1: Artifact Verification

```bash
make verify-artifacts
```

Expected: `✅ All artifact verification checks PASSED`

### Step 2: Local Install Test

```bash
make verify-local-install
```

Expected: `✅ Package verified - Safe to publish`

**Why**: Catches path resolution bugs that only appear in installed packages (prevented v0.1.9 regression).

### Step 3: npm Dry-Run

```bash
npm publish --dry-run
```

This triggers `prepublishOnly` which runs quality checks and validation.

Review the package contents listing. Resolve any failures before proceeding.

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

### Step 3: Create Signed Tag

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

### Step 5: Push to Main and Tag

```bash
git push origin main
git push origin "v$(cat VERSION)"
```

### Step 6: Approve Deployment

The workflow will pause at the `publish-npm` environment. **You must approve it in the GitHub UI:**

1. Go to: https://github.com/fulmenhq/tsfulmen/actions/workflows/release.yml
2. Find the running workflow for your tag
3. Click "Review deployments"
4. Click "Approve and deploy"

### Step 7: Monitor Workflow

Watch the workflow execution:

- Validate job: verifies tag matches VERSION
- Publish-npm job: publishes to npm via OIDC (requires approval)
- Build-artifacts job: creates release artifacts
- Release job: creates draft GitHub release
- Verify job: tests npm package installation

## Post-Release Steps

### Step 1: Review Draft Release

1. Go to: https://github.com/fulmenhq/tsfulmen/releases
2. Find the draft release for your version
3. Review:
   - [ ] Release notes are correct
   - [ ] Artifacts attached (.tgz, SHA256SUMS, SHA512SUMS)
   - [ ] Checksums look correct

### Step 2: Publish Release

Click "Publish release" to make it public.

### Step 3: Verify npm Package

```bash
npm view @fulmenhq/tsfulmen versions --json | tail -5
```

### Step 4: Verify Published Package Works

```bash
make verify-published-package
# or with explicit version:
VERIFY_PUBLISH_VERSION=$(cat VERSION) make verify-published-package
```

Expected: `✅ Package verification PASSED`

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
