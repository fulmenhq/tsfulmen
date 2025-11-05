---
title: "Publishing Guide"
description: "Release checklist for publishing @fulmenhq/tsfulmen to npm."
---

# Publishing @fulmenhq/tsfulmen

This checklist mirrors the hardened process used by `@3leaps/string-metrics-wasm`. Complete every step in order before publishing a new version.

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
2. Bump the version (choose one):
   ```bash
   make set-version VERSION=x.y.z
   # or planned helpers:
   # make bump-patch / make bump-minor / make bump-major
   ```
3. Update changelog / release notes as needed.

## 2. Quality Gates

Run the consolidated quality target:

```bash
make quality
```

This runs lint, typecheck, tests, build, and verification targets. Resolve all issues before continuing. The working tree must remain clean afterwards (`git status`).

## 3. Prepare Package Artifacts

Run the WASM packaging helper (safe even if no WASM artifacts are present yet):

```bash
bunx tsx scripts/prepare-wasm-package.ts
```

Commit the changes:

```bash
git add -A
git commit -m "chore: release vX.Y.Z"
# If hooks modify files:
git add -A
git commit --amend --no-edit
```

## 4. Dry-Run Publishing

Before tagging, confirm npm packaging looks correct:

```bash
npm pack --dry-run | grep .wasm   # Optional today, protects future WASM bundles
npm publish --dry-run
```

The `prepublishOnly` script will re-run quality gates automatically; resolve any failures before proceeding.

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

Use the verification script to install the published package, confirm key exports, and sanity check functionality:

```bash
bunx tsx scripts/verify-published-package.ts            # latest
bunx tsx scripts/verify-published-package.ts X.Y.Z      # specific version
```

Expected output: `✅ Package verification PASSED`

## 8. Final Steps

- Create GitHub release from the tag with changelog highlights.
- Announce the release (internal channels, release notes).
- (Optional) Sign the published package using the Fulmen npm signing key.
- Update dependent projects if necessary.

## Troubleshooting

- **Missing artifacts in tarball**: run `npm pack --dry-run` and inspect output. Ensure `scripts/prepare-wasm-package.ts` removed nested `.gitignore` files if WASM build added them.
- **`402 Payment Required`** when publishing: re-run with `--access public`.
- **Prepublish failures**: fix lint/test/build errors locally, rerun `make quality`, recommit/amend before retrying.

---

**Reminder:** Always verify the published package with `scripts/verify-published-package.ts`. This catches registry or packaging issues before consumers do.
