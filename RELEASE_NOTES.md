# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

_No unreleased changes._

---

## [0.2.5] - 2026-02-03

**Release Type**: CI/CD Fix
**Status**: Ready for Release

### Release Workflow Fix

**Summary**: Fixes post-release verification job to correctly test ESM package installation.

#### Issue Fixed

The v0.2.4 release workflow's verification job used `require()` to test the published npm package, but tsfulmen is ESM-only and doesn't export a CommonJS entry point. This caused `ERR_PACKAGE_PATH_NOT_EXPORTED` errors in the verify job.

#### Solution

- Updated `.github/workflows/release.yml` verify job to use dynamic `import()` instead of `require()`
- Maintains version assertion check while respecting package's ESM-only nature
- Ensures post-release verification correctly validates published packages

#### Quality Gates

- Tests: All passing
- Lint: Clean
- TypeCheck: Clean
- Workflow: Validated with dry-run

---

## [0.2.4] - 2026-02-01

**Release Type**: Infrastructure + CI/CD
**Status**: Ready for Release

### Automated Release Workflow with npm OIDC

**Summary**: Replaces manual npm publish and GitHub release creation with fully automated workflow using OIDC trusted publishing. Eliminates need for NPM_TOKEN secrets and ensures consistent, secure releases.

#### New Features

- **GitHub Actions Release Workflow** (`.github/workflows/release.yml`)
  - Triggers on signed tag push (`v*.*.*`)
  - Validates tag matches VERSION file
  - Runs full quality gates (lint, typecheck, test)
  - Publishes to npm via OIDC trusted publishing
  - Creates draft GitHub release with artifacts
  - Post-release verification (npm install + smoke test)

- **OIDC Trusted Publishing**
  - No long-lived NPM_TOKEN secrets required
  - Automatic provenance attestation for supply chain security
  - Short-lived, cryptographically-signed tokens from GitHub
  - Scoped to specific workflow file

- **Deployment Protection**
  - `publish-npm` environment with manual approval gate
  - Tag pattern: `v*` (matches all version tags)
  - Required reviewer: 1 (maintainer)
  - Prevents accidental publishes

#### Security Improvements

- **Secret Elimination**: Removed dependency on NPM_TOKEN secrets
- **Provenance**: Automatic npm provenance attestation
- **Audit Trail**: GitHub environments log all deployments
- **Approval Gate**: Manual review before npm publish

#### Process Changes

**Before (Manual)**:

1. Push tag
2. Wait for CI
3. Run `npm publish --access public` locally
4. Create GitHub release manually
5. Upload artifacts manually

**After (Automated)**:

1. Push signed tag
2. Approve deployment in GitHub UI
3. Workflow handles everything (publish + release + verification)

#### Prerequisites

- GitHub Environment: `publish-npm` (tag pattern: `v*`)
- npm Trusted Publisher: Configured at npmjs.com
- Secrets: All NPM_TOKEN secrets removed

#### Quality Gates

- Tests: 2097 passing
- Lint: Clean
- TypeCheck: Clean
- Workflow: Validated with dry-run

---

## [0.2.3] - 2026-01-28

**Release Type**: Security + DevDependency Update
**Status**: Ready for Release

### Vitest 4.x Upgrade - CVE Remediation

**Summary**: Upgrades vitest test framework from v2.1.9 to v4.0.18, eliminating 70 Go stdlib CVEs in dev/CI toolchain. No changes to shipped library code.

#### Security Impact

The vitest 2.x/3.x dependency chain included vite 5.x, which bundled an esbuild binary compiled with Go 1.20.12. This Go version has multiple critical CVEs. Upgrading to vitest 4.x pulls vite 7.x with esbuild compiled on Go 1.25.5.

| Metric    | Before | After | Change  |
| --------- | ------ | ----- | ------- |
| Critical  | 6      | 0     | -6      |
| High      | 34     | 10    | -24     |
| Medium    | 54     | 14    | -40     |
| **Total** | 94     | 24    | **-70** |

**Scope clarification**:

- **Production code surface**: 0 vulnerabilities
- **Dev/CI tooling**: 24 findings (all in esbuild binaries used by vitest/vite)

These vulnerabilities only affected dev/CI tooling (test runner), not the published library.

#### Performance

Test suite execution improved by 32% (56s → 38s).

#### Quality Gates

- Tests: 2097 passing
- Lint: Clean
- TypeCheck: Clean

---

## [0.2.2] - 2026-01-28

**Skipped** - Version number consumed by npm publish workflow. See v0.2.3.

---

## [0.2.0] - 2026-01-13

**Release Type**: Infrastructure + Governance + SSOT
**Status**: Ready for Release

### Role-Based Agent Model, Supply Chain Security & Crucible v0.4.8

**Summary**: Major infrastructure update adopting role-based AI agent identity model (replacing named identities), trust anchor bootstrap pattern, package cooling policy for supply chain security, and comprehensive Crucible SSOT update to v0.4.8.

#### Governance: Identity → Role Migration

Migrated from named agent identities (e.g., "Module Weaver") to functional roles per Crucible AI Agents Standard v2.0.0:

| Previous      | New Role   | Use Case                        |
| ------------- | ---------- | ------------------------------- |
| Module Weaver | `devlead`  | Implementation, features, fixes |
| -             | `devrev`   | Code review, four-eyes audit    |
| -             | `infoarch` | Documentation, schemas          |
| EA Steward    | `entarch`  | Ecosystem coordination          |
| -             | `secrev`   | Security review                 |
| -             | `cicd`     | CI/CD automation                |
| -             | `dataeng`  | Data engineering                |
| -             | `prodmktg` | Product marketing               |
| -             | `uxdev`    | UX development                  |

**Files Updated**:

- `AGENTS.md` - Complete rewrite for role-based operating model
- `MAINTAINERS.md` - Removed AI Co-Maintainers section, added role table
- `docs/development/adr/*.md` - Frontmatter updated to role slugs
- `docs/tsfulmen_overview.md` - Author changed to role
- `src/*/README.md` - Attribution updated

**Attribution Format**:

```
Generated by <Model> via <Interface> under supervision of @maintainer

Co-Authored-By: <Model> <noreply@3leaps.net>
Role: <role>
Committer-of-Record: <Name> <email> [@handle]
```

#### Infrastructure: Trust Anchor Bootstrap

New `scripts/make-bootstrap.sh` implementing the sfetch → goneat trust pyramid:

1. **sfetch** installed via published installer (trust anchor)
2. **sfetch self-verify** confirms cryptographic integrity
3. **goneat** installed via sfetch with minisign verification
4. **Foundation tools** installed via `goneat doctor tools --scope foundation`

Consistent with pyfulmen/rsfulmen bootstrap patterns.

#### Supply Chain Security

**Package Cooling Policy** (`.goneat/dependencies.yaml`):

- 7-day minimum age for new packages
- 100 minimum downloads threshold
- Exception for `@fulmenhq/*` organization packages
- Build fails on violations (not alert-only)

**License Compliance**:

- Forbidden: GPL, LGPL, AGPL, MPL, CDDL
- Allowed: MIT, Apache-2.0, BSD, ISC, Unlicense, CC0
- `make license-audit` generates inventory report

**Pre-push Hooks**: Now include `dependencies` category assessment.

#### SSOT Updates: Crucible v0.4.8

- **Role Catalog Expanded**: devlead, devrev, infoarch, entarch, secrev, cicd, dataeng, prodmktg, uxdev, qa
- **Signal Resolution Standard**: Cross-language fixtures for signal handling validation
- **TUI Design System Schemas**: `schemas/crucible-ts/design/` with color, typography, layout, component schemas
- **OpenAPI Spec Coverage Standard** (ADR-0014): Standardized API documentation coverage
- **Ecosystem Branding**: `config/crucible-ts/branding/ecosystem.yaml`
- **Similarity Module Promotion**: Relocated to `config/crucible-ts/library/similarity/`
- **Canonical URI Resolution**: Standard for spec publishing and cross-repo references

#### New Features

- **Signals Module Entry Point**: `@fulmenhq/tsfulmen/signals` for direct signal handling access
- **Embedded App Identity Fallback**: Resilient identity discovery when `.fulmen/app.yaml` not in ancestor path

#### Quality Gates

- Tests: All passing
- Lint: Clean
- TypeCheck: Clean
- License Audit: No forbidden licenses

---

## [0.1.14] - 2025-11-28

**Release Type**: Feature Update + SSOT Sync
**Status**: Released

### FulHash Extensions & CRC Support

**Summary**: Expanded the `fulhash` module with CRC32/CRC32C support, unified the hashing stack on `hash-wasm`, and added high-performance convenience helpers for multi-hashing and verification.

#### New Features: @fulmenhq/tsfulmen/fulhash

**Expanded Algorithms**:

- **CRC32**: Standard IEEE 802.3 polynomial (fast error detection)
- **CRC32C**: Castagnoli polynomial (optimized for iSCSI/SCTP)
- **Unified Stack**: All algorithms (XXH3, SHA, CRC) now powered by `hash-wasm` for consistent WASM performance and zero-dependency bloat.

**Convenience API**:

- **`multiHash(input, algorithms)`**: Compute multiple checksums (e.g., SHA256 + CRC32) in a single pass over the data.
- **`verify(input, checksum)`**: Validate data against a formatted checksum string (e.g., `crc32:cbf43926`).
- **Streaming Support**: Full streaming parity for all algorithms with async initialization.

**Performance**:

- XXH3-128: ~5 GB/s (streaming/block)
- SHA-256: ~2 GB/s
- CRC32/C: ~1.2 GB/s (via WASM)

#### SSOT Updates

- **Crucible v0.2.20**: Synced latest fulhash types and taxonomy.

#### Quality Gates

- **Tests**: 1786 tests passing (+30 new CRC/multihash tests)
- **Benchmarks**: New standalone benchmark suite in `scripts/perf/fulhash-crc-benchmark.ts`
- **Dependencies**: Removed `crc-32` and `fast-crc32c` (net -2 prod deps)

---

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md`.
