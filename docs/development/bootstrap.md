# TSFulmen Bootstrap Guide

This document chronicles the TSFulmen repository bootstrap process and provides guidance for contributors setting up their development environment.

**Date:** 2025-10-10  
**Bootstrap Method:** Bun + sfetch trust anchor + goneat  
**Bootstrap Guide:** [Goneat Bootstrap Guide](../crucible-ts/guides/bootstrap-goneat.md)

> Note: this file contains historical bootstrap notes from early v0.1.x.
> Current setup uses `sfetch` as the trust anchor to install `goneat`.

## Overview

TSFulmen is the TypeScript/Node.js helper library in the Fulmen ecosystem, providing ergonomic access to Crucible SSOT assets and core utilities. This bootstrap process follows the **Fulmen Helper Library Standard** with goneat as the primary tooling CLI.

## Prerequisites

- ✅ Bun >= 1.0.0 (or Node.js 18+)
- ✅ Git
- ✅ make available
- ✅ Access to sibling repositories: `../crucible`, `../goneat` (optional for local development)

## Bootstrap Steps

### 1. Goneat Tool Setup

TSFulmen bootstraps `goneat` via `sfetch` (trust-anchor model).

```bash
# Installs deps, ensures sfetch + goneat are installed into a PATH location
make bootstrap
```

**Local Development (optional)**

If you are developing goneat locally, you can temporarily point TSFulmen at your local build:

```bash
# Replace the installed goneat with a symlink to your local build
ln -sf ../goneat/dist/goneat "$HOME/.local/bin/goneat"

# Verify
goneat --version
```

**Result:** `goneat` available on `PATH`

### 2. Version Management

```bash
cat VERSION  # 0.1.0
```

Following SemVer for initial development (0.x.y).

### 3. Goneat Configuration

**Hooks config** lives in `.goneat/hooks.yaml` and should use `goneat assess` directly.

**Tools manifest** lives in `.goneat/tools.yaml` and is reserved for _additional_ external tools.
TSFulmen no longer self-installs `goneat` via `.goneat/tools.yaml`.

Current `.goneat/tools.yaml` example:

```yaml
version: v0.3.4
binDir: ./bin
tools: []
```

**Local overrides**

If you need machine-specific tool configuration, prefer `.goneat/tools.local.yaml` (gitignored)
for _non-goneat_ tools only.

### 4. SSOT Sync Configuration

**`.goneat/ssot-consumer.yaml`**:

```yaml
version: v1.1.0
sources:
  - name: crucible
    repo: fulmenhq/crucible
    ref: main
    sync_path_base: lang/typescript
    assets:
      - type: doc
        source_path: docs
        paths:
          - "architecture/**/*.md"
          - "standards/**/*.md"
          - "guides/**/*.md"
          - "sop/**/*.md"
        subdir: docs/crucible-ts
      - type: schema
        source_path: schemas
        paths: ["**/*"]
        subdir: schemas/crucible-ts
      - type: config
        source_path: config
        paths: ["**/*"]
        subdir: config/crucible-ts
      - type: metadata
        source_path: config/sync
        paths: ["**/*"]
        subdir: .crucible/metadata
strategy:
  on_conflict: overwrite
  prune_stale: true
  verify_checksums: false
```

**`.goneat/ssot-consumer.local.yaml`** (Auto-generated, Gitignored):

```yaml
version: v1.1.0
sources:
  - name: crucible
    localPath: ../crucible
```

### 5. TypeScript Project Files

**package.json:**

```json
{
  "name": "@fulmenhq/tsfulmen",
  "version": "0.1.0",
  "description": "TypeScript Fulmen helper library - ergonomic access to Crucible SSOT and core utilities",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./config": {
      "import": "./dist/config/index.js",
      "types": "./dist/config/index.d.ts"
    },
    "./crucible": {
      "import": "./dist/crucible/index.js",
      "types": "./dist/crucible/index.d.ts"
    }
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 6. Makefile with Bun Integration

Created `Makefile` following the Fulmen Makefile Standard:

Key targets:

- `make bootstrap`: Install dependencies with `bun install` and goneat
- `make lint`: Run Biome checks
- `make test`: Run Vitest tests
- `make build`: Build with tsup
- `make typecheck`: TypeScript type checking

### 7. Gitignore Configuration

Updated `.gitignore` with:

- Goneat binary exclusions (legacy: `bin/goneat`; prefer PATH installs)
- Crucible sync asset exclusions (regenerated from source)
- Goneat local overrides (`.goneat/*.local.yaml`)
- TypeScript-specific artifacts (`dist/`, `*.tsbuildinfo`)
- Node.js artifacts (`node_modules/`, `bun.lockb`)

### 8. Crucible Sync

```bash
make sync-ssot
```

**Result:** Successfully synced assets from Crucible:

- Standards documentation → `docs/crucible-ts/`
- Schemas → `schemas/crucible-ts/`
- Config files → `config/crucible-ts/`
- Metadata → `.crucible/metadata/`

### 9. Bun Bootstrap

```bash
bun install
```

**Result:**

- Installed development dependencies
- Created `bun.lock` for reproducible builds
- Ready for development

### 10. Verification

```bash
make check-all
```

**Result:** ✅ All quality checks passed

- Linting: Clean
- Type checking: Clean
- Tests: run `make test`

### 11. Git Hooks with Guardian Support

TSFulmen uses goneat's hooks system with guardian approval enforcement for sensitive git operations.

**Setup Process:**

```bash
# 1. Initialize hooks system (creates defaults)
goneat hooks init

# 2. Configure .goneat/hooks.yaml to run goneat assess directly
#    (preferred over delegating to Makefile targets)

# 3. Generate hooks with guardian support
goneat hooks generate --with-guardian

# 4. Install to .git/hooks
goneat hooks install

# 5. Validate setup
goneat hooks validate
```

**Configuration (`.goneat/hooks.yaml`):**

- Pre-commit: `goneat assess` with categories `format,lint` (fail-on `critical`)
- Pre-push: `goneat assess` with categories `format,lint,security` (fail-on `high`)
- Optimization: `only_changed_files: true` to avoid noisy full-repo scans

**Guardian Integration:**

```bash
# Test guardian check (will require browser approval)
goneat guardian check git commit --branch main
```

**Result:** ✅ Hooks installed and validated, guardian integration confirmed working

## Key Implementation Decisions

### 1. Package Manager: Bun

- Faster than npm/yarn
- Native TypeScript support
- Compatible with Node.js ecosystem
- Excellent developer experience

### 2. Build Tool: tsup

- Zero-config bundler
- Dual ESM/CJS exports
- Type declaration generation
- Fast builds

### 3. Test Framework: Vitest

- Fast test execution
- Native ESM support
- Compatible with Bun
- Great developer experience

### 4. Linter: Biome

- Fast Rust-based linter
- Replaces ESLint + Prettier
- Consistent formatting
- TypeScript-aware

## Current State

✅ Repository fully bootstrapped and ready for development
✅ Goneat integration working (SSOT sync, validation)
✅ Crucible standards and schemas synced
✅ Bun package management configured
✅ All quality checks passing
✅ Git hooks installed with guardian support
✅ Pre-commit/pre-push validation automated

## Next Steps

1. ✅ Complete goneat bootstrap migration
2. ✅ Create governance files (AGENTS.md, MAINTAINERS.md, REPOSITORY_SAFETY_PROTOCOLS.md)
3. ✅ Create architecture overview (docs/tsfulmen_overview.md)
4. ✅ Create development documentation (docs/development/)
5. ✅ Add LICENSE and CONTRIBUTING.md
6. ✅ Create CHANGELOG.md and RELEASE_NOTES.md
7. ✅ Create release documentation (docs/releases/v0.1.0.md)
8. ✅ Create ADR structure with local ADR-0001 (split linting)
9. ✅ Implement git hooks with guardian support
10. ✅ Prepare v0.1.0 foundation release (ready to tag)
11. 🚧 Implement enterprise upscaling (7 core modules for v0.1.1+)
12. 📋 Add comprehensive test suite (80%+ coverage)
13. 📋 Generate API documentation
14. 📋 Publish to npm registry

## Commands Reference

```bash
# Bootstrap environment
make bootstrap

# Sync Crucible assets
make sync-ssot

# Development cycle
make fmt lint typecheck test

# Quality checks
make check-all

# Pre-commit/pre-push checks (same as hooks run)
make precommit
make prepush

# Git hooks management
goneat hooks init       # Initialize hooks configuration
goneat hooks generate --with-guardian   # Generate hook files
goneat hooks install    # Install hooks to .git/hooks
goneat hooks validate   # Validate hooks setup

# Guardian testing
goneat guardian check git commit --branch main

# Build
make build

# Version management
make version-bump-patch
make version-bump-minor
make version-bump-major
make version-bump-calver

# Clean
make clean
```

## Notes for Contributors

- Always use `make` targets instead of direct tool invocations
- Keep `.goneat/tools.local.yaml` for local goneat development
- Run `make sync-ssot` weekly or before major changes
- Check sibling repositories (gofulmen, pyfulmen) for implementation patterns
- Follow TypeScript strict mode and coding standards
- Maintain 80%+ test coverage

## Troubleshooting

### Goneat Not Found

```bash
# Verify goneat installation
goneat version

# Reinstall if needed
make bootstrap-force
```

### Sync Failures

```bash
# Check local Crucible path
ls ../crucible/lang/typescript

# Use remote sync if local unavailable
rm .goneat/ssot-consumer.local.yaml
make sync-ssot
```

### Build Errors

```bash
# Clean and rebuild
make clean
make build

# Check TypeScript errors
make typecheck
```

---

**Last Updated:** 2025-12-20
**Status:** Active (v0.1.15)
