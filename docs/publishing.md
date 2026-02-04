---
title: "Publishing Guide"
description: "Release checklist for publishing @fulmenhq/tsfulmen to npm."
---

# Publishing @fulmenhq/tsfulmen

> **Quick Reference**: See [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) at repo root for the condensed checklist with dry-run gates.

## ⚠️ Process Discipline Warning

**Case Study: v0.2.5 Failure (2026-02-03)**

We burned version 0.2.5 by skipping Step 3.5 (`make verify-local-install`) before tagging. The package published successfully to npm but was completely broken.

**What Happened**:

- Created tag v0.2.5 without running `verify-local-install`
- CI published to npm with broken ESM imports (missing `.js` extensions)
- Discovered failure in post-release verification
- v0.2.5 permanently unusable on npm (cannot republish same version)
- Required emergency v0.2.6 release same day

**Root Cause**: Process discipline failure - skipped mandatory verification step documented in this guide.

**Lesson**: Every step exists because someone learned it the hard way. **Do not skip steps.**

---

This guide provides detailed step-by-step instructions for the release process. It mirrors the hardened process used by `@3leaps/string-metrics-wasm`. Complete every step in order before publishing a new version.

> **Prerequisites**
>
> - npm account with publish access to the `@fulmenhq` scope
> - Clean working tree (`git status` reports no changes)
> - Toolchain installed (`make bootstrap` recommended)

## 1. Bump Version

1. Confirm current status:
   ```bash
   git status
   ```
2. Update VERSION file and propagate via the make target (runs goneat + additional sync logic):
   ```bash
   echo "X.Y.Z" > VERSION
   make version-sync
   ```
   > `version-sync` updates `package.json`, `src/index.ts`, and `src/__tests__/index.test.ts` so the exported VERSION constant and test baseline stay aligned. Always use this target instead of calling `goneat version propagate` directly.
3. Update CHANGELOG.md and RELEASE_NOTES.md with release information.
4. Commit version bump:
   ```bash
   git add VERSION package.json src/index.ts src/__tests__/index.test.ts CHANGELOG.md RELEASE_NOTES.md
   git commit -m "chore: bump to vX.Y.Z"
   ```

## 2. Quality Gates

Run the consolidated quality target:

```bash
make quality
```

This runs lint, typecheck, tests, build, and verification targets. Resolve all issues before continuing. The working tree must remain clean afterwards (`git status`).

## 3. Verify Package Artifacts

Run automated pre-publish artifact verification:

```bash
make verify-artifacts
```

This verifies:

- All 13 module entry points (JS + .d.ts files)
- Runtime SSOT assets (config/crucible-ts, schemas/crucible-ts)
- Package integrity hashes (SHA-1, SHA-512)
- Package.json exports configuration

Expected output: `✅ All artifact verification checks PASSED`

## 3.5. Verify Local Install (Critical)

Test runtime functionality with local package install to catch path resolution issues:

```bash
make verify-local-install
```

> **Developer Note:** Update `scripts/verify-local-install.ts` when adding new modules to ensure they are loadable in an installed context (e.g., checking for correct export paths).

This critical step:

- Packs the package locally (`npm pack`)
- Installs to temporary directory
- Tests catalog loading and runtime path resolution
- Validates all entry points work in installed context

Expected output: `✅ Package verified - Safe to publish`

**Why this matters**: This step catches bugs that only manifest in installed packages (like path resolution issues that don't appear during development). It prevented the v0.1.9 catalog loading bug from recurring.

## 4. Dry-Run Publishing

Before tagging, confirm npm packaging looks correct:

```bash
npm publish --dry-run
```

The `prepublishOnly` script will:

1. Run `bun run quality` (lint, typecheck, tests, build)
2. Run `bun run validate:all` (package integrity validation)
3. Run `bun run verify:local` (local install verification)
4. Execute `scripts/prepare-wasm-package.ts` (cleanup)

The validation step ensures:

- All package.json exports exist in dist/ (validate-exports)
- tsup config matches package exports (validate-tsup-config)
- Source modules are properly mapped (validate-source-modules)
- Package structure is complete (validate-package-contents)
- Consumer imports work (validate-imports)
- Type declarations are complete (validate-types)

Resolve any failures before proceeding. Note: Tests must pass with bun/vitest.

## 5. Tag & Push

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

Wait for CI to pass before publishing.

## 6. Publish to npm

Scoped packages default to private, so include `--access public`:

```bash
npm publish --access public
```

## 7. Post-Publish Verification

Use the `make verify-published-package` target to install the published package, confirm key exports, and sanity check functionality. The target automatically runs `make build` first and defaults to verifying the version tracked in `VERSION`.

```bash
make verify-published-package                                   # verify VERSION from repository
VERIFY_PUBLISH_VERSION=latest make verify-published-package      # override version/tag
```

You can also call the script directly when needed:

```bash
bunx tsx scripts/verify-published-package.ts            # latest
bunx tsx scripts/verify-published-package.ts X.Y.Z      # specific version
```

> **Developer Note:** When adding new modules, update `scripts/verify-published-package.ts` to import and verify the new module's exports. This prevents "ghost exports" where code exists but isn't reachable by consumers.

Expected output: `✅ Package verification PASSED`

## 8. Generate Release Checksums

For GitHub releases, generate SHA-256 and SHA-512 checksums:

```bash
bunx tsx scripts/generate-checksums.ts fulmenhq-tsfulmen-X.Y.Z.tgz
```

This creates:

- `SHA256SUMS` - Industry standard checksum file
- `SHA512SUMS` - Additional security verification

Attach these files to the GitHub release for users who download tarballs directly.

## 9. Final Steps

- Create GitHub release from the tag with changelog highlights.
- Attach `SHA256SUMS` and `SHA512SUMS` to the release assets.
- Announce the release (internal channels, release notes).
- (Optional) Sign the published package using the Fulmen npm signing key.
- Update dependent projects if necessary.

## Troubleshooting

### ESM Import Errors After npm Install

**Symptom**: Package works locally but fails with `ERR_MODULE_NOT_FOUND` when installed via npm.

**Example**:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/node_modules/ajv/dist/2019'
Did you mean to import "ajv/dist/2019.js"?
```

**Root Cause**: ESM requires explicit `.js` extensions for subpath imports. TypeScript/tsup doesn't add them automatically.

**Solution**:

```typescript
// ❌ Wrong (works in dev, breaks in production)
import Ajv2019 from "ajv/dist/2019";

// ✅ Correct (works everywhere)
import Ajv2019 from "ajv/dist/2019.js";
```

**Prevention**: Run `make verify-local-install` before tagging - it catches this!

### Test Timeouts in CI

**Symptom**: Tests pass locally but timeout in CI prepublish (60s).

**Root Cause**: CI runners are slower (2-core vs local hardware), or spawned processes hang when tools not in PATH.

**Solution**: Add timeouts to spawn operations:

```typescript
const timeout = setTimeout(() => {
  proc.kill();
  resolve(false);
}, 5000);
```

**Example**: `isGoneatAvailable()` in v0.2.5 hung indefinitely when goneat not in PATH.

### Other Issues

- **Missing artifacts**: run `make verify-artifacts` to get detailed report of missing files.
- **`402 Payment Required`** when publishing: re-run with `--access public`.
- **Prepublish test failures**: ensure tests run with `bun run test`, not `npm test` (uses vitest, not npm's built-in runner).
- **Flaky performance tests**: these are timing-sensitive and may need threshold adjustments under load.

---

**Reminder:** Always verify the published package with `scripts/verify-published-package.ts`. This catches registry or packaging issues before consumers do.
