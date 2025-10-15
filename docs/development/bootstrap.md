# TSFulmen Bootstrap Guide

This document chronicles the TSFulmen repository bootstrap process and provides guidance for contributors setting up their development environment.

**Date:** 2025-10-10  
**Bootstrap Method:** Goneat-based (migrated from FulDX)  
**Bootstrap Guide:** [Goneat Bootstrap Guide](../crucible-ts/guides/bootstrap-goneat.md)

## Overview

TSFulmen is the TypeScript/Node.js helper library in the Fulmen ecosystem, providing ergonomic access to Crucible SSOT assets and core utilities. This bootstrap process follows the **Fulmen Helper Library Standard** with goneat as the primary tooling CLI.

## Prerequisites

- ✅ Bun >= 1.0.0 (or Node.js 18+)
- ✅ Git
- ✅ make available
- ✅ Access to sibling repositories: `../crucible`, `../goneat` (optional for local development)

## Bootstrap Steps

### 1. Goneat Tool Setup

**Production (CI/CD):**

```bash
# Goneat installed via package manager or downloaded from GitHub releases
# See .goneat/tools.yaml for configuration
make bootstrap
```

**Local Development:**

```bash
# Copy local override template
cp .goneat/tools.local.yaml.example .goneat/tools.local.yaml

# Edit to point to local goneat build
# source: ../goneat/dist/goneat

# Bootstrap uses local override
make bootstrap
```

**Result:** Goneat installed to `./bin/goneat`

### 2. Version Management

```bash
cat VERSION  # 0.1.0
```

Following SemVer for initial development (0.x.y).

### 3. Goneat Configuration

**`.goneat/tools.yaml`** (Production):

```yaml
version: v0.3.0
binDir: ./bin
tools:
  - id: goneat
    description: Fulmen schema validation and automation CLI
    required: true
    install:
      type: download
      url: https://github.com/fulmenhq/goneat/releases/download/v0.3.0/goneat-{{os}}-{{arch}}
      binName: goneat
      destination: ./bin
      checksum:
        darwin-arm64: "0" # TODO: Replace with actual checksums
        darwin-amd64: "0"
        linux-amd64: "0"
        linux-arm64: "0"
```

**`.goneat/tools.local.yaml`** (Local Development - Gitignored):

```yaml
version: v0.3.0-dev
binDir: ./bin
tools:
  - id: goneat
    install:
      type: link
      source: ../goneat/dist/goneat
      binName: goneat
      destination: ./bin
```

**Critical:** `.goneat/tools.local.yaml` is **machine-specific and gitignored**. It should **never be committed**. Each developer creates their own local override pointing to their goneat build location.

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

- Goneat binary exclusions (`/bin/goneat`)
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
- Tests: 2 tests passing

### 11. Git Hooks with Guardian Support

Implemented intelligent git hooks using goneat's hooks system with guardian approval enforcement for sensitive operations.

**Setup Process:**

```bash
# 1. Initialize hooks system (auto-detects Makefile targets)
bin/goneat hooks init

# 2. Edit .goneat/hooks.yaml to use Makefile targets (matching pyfulmen pattern)
# Changed from default to:
#   pre-commit: make precommit
#   pre-push: make prepush

# 3. Generate hooks with guardian support
bin/goneat hooks generate --with-guardian

# 4. Install to .git/hooks
bin/goneat hooks install

# 5. Validate setup
bin/goneat hooks validate
```

**Configuration (`.goneat/hooks.yaml`):**

```yaml
version: "1.0.0"
hooks:
  pre-commit:
    - command: "make"
      args: ["precommit"]
      priority: 10
      timeout: "60s"
  pre-push:
    - command: "make"
      args: ["prepush"]
      priority: 10
      timeout: "2m"
optimization:
  cache_results: true
  content_source: working
  only_changed_files: false
  parallel: auto
```

**What Runs in Each Hook:**

Pre-commit (`make precommit`):
1. Format TypeScript/JavaScript with Biome
2. Format YAML/JSON/Markdown with goneat
3. Lint TypeScript/JavaScript with Biome
4. Assess YAML/JSON/Markdown with goneat
5. Type check with tsc

Pre-push (`make prepush`):
1. Runs all pre-commit checks
2. Additional validation

**Guardian Integration:**

Guardian provides approval-based protection for sensitive git operations:

```bash
# Test guardian check (will require browser approval)
bin/goneat guardian check git commit --branch main

# Guardian will:
# - Launch local approval server (127.0.0.1:random-port)
# - Open browser for approval/denial
# - Block operation until approved
# - Expire approval after timeout (default: 5m)
```

**DX Notes:**

✅ **Excellent Auto-Detection**: `goneat hooks init` detected our Makefile and auto-configured hooks.yaml
✅ **Simple Manual Edit**: Only needed to simplify hooks.yaml to match pyfulmen's pattern (delegate to make targets)
⚠️ **Feature Request**: `goneat hooks set-command` (planned for v0.3.1) will eliminate manual YAML editing
✅ **Guardian UX**: Browser-based approval flow with clear project context and expiry timing

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
bin/goneat hooks init       # Initialize hooks configuration
bin/goneat hooks generate   # Generate hook files
bin/goneat hooks install    # Install hooks to .git/hooks
bin/goneat hooks validate   # Validate hooks setup

# Guardian testing
bin/goneat guardian check git commit --branch main

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
./bin/goneat version

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

**Last Updated:** 2025-10-15
**Status:** Foundation Complete - Ready for v0.1.0 Release
