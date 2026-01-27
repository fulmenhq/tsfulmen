# Release Checklist (tsfulmen)

tsfulmen is a TypeScript library: releases are **npm packages** published to `@fulmenhq/tsfulmen` on npmjs.com,
plus git tags for version tracking.

This checklist follows the shared ecosystem pattern (gofulmen/pyfulmen/tsfulmen/rsfulmen) codified in Crucible.

> **Detailed Steps**: See [docs/publishing.md](docs/publishing.md) for expanded instructions on each step.

## Tag Signing Status

| Feature | Status | Notes |
|---------|--------|-------|
| GPG-signed tags | **IMPLEMENTED** | Uses `git tag -s` via `make release-tag` |
| Minisign attestation | **OPTIONAL** | Set `TSFULMEN_MINISIGN_KEY` and `TSFULMEN_MINISIGN_PUB` |
| npm package signing | **NOT IMPLEMENTED** | Optional future enhancement |

## Variables (Quick Reference)

- `TSFULMEN_RELEASE_TAG`: override tag (default: `v$(cat VERSION)`)
- `TSFULMEN_GPG_HOMEDIR`: dedicated signing keyring directory (recommended)
- `TSFULMEN_PGP_KEY_ID`: GPG key id/email/fingerprint for signing
- `TSFULMEN_MINISIGN_KEY`: minisign secret key path (optional sidecar)
- `TSFULMEN_MINISIGN_PUB`: minisign public key path (optional sidecar)
- `TSFULMEN_ALLOW_NON_MAIN`: set to `1` to allow tagging from non-main branch
- `VERIFY_PUBLISH_VERSION`: override version for post-publish verification (default: `$(cat VERSION)`)

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

This triggers `prepublishOnly` which runs:
1. Quality checks (lint, typecheck, tests, build)
2. Package validation suite
3. Local install verification

Review the package contents listing. Resolve any failures before proceeding.

### Step 4: Final Status Check

```bash
git status
```

Must be clean. If version-sync created changes, commit them first.

## Tagging

> **WARNING**: Once a tag is pushed and npm publish succeeds, the version is burned.
> Do not proceed until ALL dry-run steps pass.

- [ ] Ensure GPG can prompt for passphrase:
  ```bash
  export GPG_TTY="$(tty)"
  gpg-connect-agent updatestartuptty /bye
  ```

- [ ] Run guard check:
  ```bash
  make release-guard-tag-version
  ```

- [ ] Create signed tag:
  ```bash
  make release-tag
  ```

- [ ] Verify tag locally:
  ```bash
  make release-verify-tag
  # or manually:
  git verify-tag v$(cat VERSION)
  ```

- [ ] Push commits and tag:
  ```bash
  git push origin main
  git push origin v$(cat VERSION)
  ```

- [ ] Wait for CI to pass on the tag before publishing.

## Publish to npm

- [ ] Publish (scoped packages require `--access public`):
  ```bash
  npm publish --access public
  ```

- [ ] Verify on npmjs.com:
  ```bash
  npm view @fulmenhq/tsfulmen versions --json | tail -5
  ```

## Post-Release Verification

- [ ] Verify published package works:
  ```bash
  make verify-published-package
  # or with explicit version:
  VERIFY_PUBLISH_VERSION=$(cat VERSION) make verify-published-package
  ```

  Expected: `✅ Package verification PASSED`

- [ ] Generate checksums for GitHub release:
  ```bash
  npm pack
  bunx tsx scripts/generate-checksums.ts fulmenhq-tsfulmen-$(cat VERSION).tgz
  ```

- [ ] Create GitHub release:
  - Go to https://github.com/fulmenhq/tsfulmen/releases/new
  - Select tag `v$(cat VERSION)`
  - Title: `v$(cat VERSION)`
  - Description: Copy from RELEASE_NOTES.md
  - Attach: `SHA256SUMS`, `SHA512SUMS`, `.tgz` file

- [ ] Clean up local artifacts:
  ```bash
  rm -f *.tgz SHA256SUMS SHA512SUMS
  ```

## Rollback (If Needed)

npm does not allow republishing the same version. If a critical bug is found:

1. Deprecate the bad version:
   ```bash
   npm deprecate @fulmenhq/tsfulmen@X.Y.Z "Critical bug - use X.Y.Z+1"
   ```

2. Bump patch version and repeat release process.

3. Delete the git tag if it was never intended to be released:
   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

## Troubleshooting

### GPG pinentry dialog not appearing

If the GPG passphrase dialog doesn't appear (especially in Ghostty or certain terminal sizes):

1. **Kill and restart gpg-agent** (caution: may affect other GPG operations):
   ```bash
   gpgconf --kill gpg-agent
   ```

2. **Force TTY refresh before signing**:
   ```bash
   export GPG_TTY=$(tty)
   gpg-connect-agent updatestartuptty /bye
   make release-tag
   ```

3. **Test pinentry directly**:
   ```bash
   echo "GETPIN" | pinentry-mac
   ```
   If this fails, check `~/.gnupg/gpg-agent.conf` has:
   ```
   pinentry-program /opt/homebrew/bin/pinentry-mac
   ```

4. **Try a different terminal** (iTerm2 is known to work reliably).

5. **Check for hidden dialog** - pinentry-mac may appear behind other windows.

### npm publish fails with 402

Scoped packages default to private. Use:
```bash
npm publish --access public
```

### Tag already exists

If you need to recreate a tag (use with caution):
```bash
git tag -d vX.Y.Z                    # delete local
git push origin :refs/tags/vX.Y.Z   # delete remote
make release-tag                     # recreate
```

## Cross-References

- [Publishing Guide](docs/publishing.md) - Detailed step-by-step instructions
- [Release Notes](RELEASE_NOTES.md) - Current and recent release summaries
- [Changelog](CHANGELOG.md) - Full version history
- [rsfulmen RELEASE_CHECKLIST.md](https://github.com/fulmenhq/rsfulmen/blob/main/RELEASE_CHECKLIST.md) - Signed tag reference implementation
