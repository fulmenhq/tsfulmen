# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

### HTTP Server Metrics - v0.1.11

**Release Type**: New Feature
**Status**: 🚧 Ready for Release

#### Summary

Implements Crucible v0.2.18 HTTP metrics taxonomy with type-safe helpers for instrumenting HTTP servers. Provides production-ready middleware for Express, Fastify, and Bun with automatic route normalization, unit conversion, and AppIdentity integration. Comprehensive documentation includes framework examples, troubleshooting guide, and production best practices.

#### New Module: @fulmenhq/tsfulmen/telemetry/http

**Core Helpers** (475 lines):

1. **recordHttpRequest(options)** - Records all applicable HTTP metrics
   - Automatic unit conversion: milliseconds → seconds for duration
   - Auto-injects service label from AppIdentity (fallback: "unknown")
   - Records up to 4 metrics per request (counter + 3 optional histograms)
   - Type-safe labels enforced at compile time

2. **trackActiveRequest(service?)** - Active requests gauge management
   - Returns cleanup function for guaranteed decrement
   - Safe for concurrent requests across multiple services
   - Integrates with middleware error handling

**Framework Middleware**:

1. **createHttpMetricsMiddleware(options)** - Express/Connect
   - Automatic request lifecycle tracking
   - Configurable route normalizer (defaults to req.route?.path || req.path)
   - Optional body size tracking via content-length headers
   - Cleanup on finish/error/close events

2. **createFastifyMetricsPlugin(options)** - Fastify
   - Hook-based instrumentation (onRequest, onResponse, onError)
   - Route template extraction from req.routeOptions.url (Fastify v3+)
   - Request context storage for timing and cleanup

3. **createBunMetricsHandler(handler, options)** - Bun.serve
   - Fetch handler wrapper with metrics
   - Pathname normalization required (no built-in routing)
   - Error-safe cleanup with try/catch

**Metrics Emitted** (Crucible v0.2.18 Taxonomy):

| Metric                        | Type      | Unit  | Labels                         |
| ----------------------------- | --------- | ----- | ------------------------------ |
| http_requests_total           | Counter   | count | method, route, status, service |
| http_request_duration_seconds | Histogram | s     | method, route, status, service |
| http_request_size_bytes       | Histogram | bytes | method, route, service         |
| http_response_size_bytes      | Histogram | bytes | method, route, status, service |
| http_active_requests          | Gauge     | count | service                        |

**Critical Implementation Details**:

- **Unit Conversion**: Duration auto-converts ms → seconds (123.456ms → 0.123456s)
- **Route Normalization**: Callers must normalize routes to prevent cardinality explosion
  - Use framework templates: `req.route?.path` (Express), `req.routeOptions?.url` (Fastify)
  - Or use Phase 2 `normalizeRoute()` utility: `/users/123` → `/users/:userId`
- **Body Size Tracking**: Disabled by default for performance
  - Only records when `trackBodySizes: true` AND content-length headers present
  - Read from headers, no body parsing overhead

**Documentation** (636 lines total):

- **API Reference**: Complete function signatures with TypeScript types
- **Framework Integration**: 4 framework examples (Express, Fastify, Bun, Node.js HTTP)
- **Troubleshooting**: 6 common issues with symptoms/causes/solutions
  - High cardinality warning (non-normalized routes)
  - "unknown" routes in metrics (fallback behavior)
  - Missing size metrics (trackBodySizes disabled)
  - Unit conversion issues (direct histogram usage)
  - Service label missing (AppIdentity not loaded)
  - Fastify version compatibility (req.routeOptions undefined)
- **Production Recommendations**: 5 best practices
  - Always normalize routes
  - Monitor cardinality with Prometheus alerts
  - Use explicit service names
  - Enable body sizes selectively
  - Test route normalization in CI
- **Framework Notes**: Version compatibility, route extraction patterns, defensive access

**Testing** (769 lines, 40+ tests):

- recordHttpRequest() tests (14 tests)
  - All 5 metrics with label combinations
  - Unit conversion accuracy (7 test cases)
  - Optional request/response size handling
  - Multiple HTTP methods and status codes
  - Service label defaults and overrides

- trackActiveRequest() tests (7 tests)
  - Increment/decrement lifecycle
  - Concurrent request tracking
  - Multi-service isolation
  - Over-release behavior (negative values)

- Middleware tests (9+ tests)
  - Express/Connect middleware with event lifecycle
  - Fastify plugin with hooks
  - Bun handler wrapper with error handling
  - Custom normalizers and extractors
  - Body size tracking with content-length

- Unit conversion accuracy (7 precision cases)

**Quality Gates**: ✅ All Passing

- Tests: 102 test files (40+ new HTTP tests)
- TypeCheck: Clean
- Lint: Clean
- Pre-commit: goneat assessment 100% health
- Coverage: 100% for HTTP helpers module

**Integration Notes**:

- Builds on Phase 2 route normalization utilities (hasCardinalityRisk, estimateCardinality)
- Uses Phase 1 MetricName types from Crucible v0.2.18 sync
- Integrates with AppIdentity module for service label defaults
- Compatible with existing telemetry registry and export pipeline

**Breaking Changes**: None (additive only)

**Migration**: N/A (new feature)

**Dependencies**: No new external dependencies

### Logging Middleware & Secure Redaction - v0.1.11

**Release Type**: New Feature
**Status**: 🚧 Ready for Release

#### Summary

Implements middleware pipeline support for STRUCTURED and ENTERPRISE logging profiles with secure-by-default redaction. Provides gofulmen-aligned patterns for cross-language consistency and a progressive interface from simple structured logging to enterprise-scale observability with comprehensive security controls.

#### New Features: @fulmenhq/tsfulmen/logging

**Middleware Pipeline Support**:

1. **StructuredLogger Middleware** - Pipeline execution before Pino emission
   - Middleware chains execute in order (left-to-right)
   - Child loggers inherit parent middleware chain
   - Child bindings merge (child overrides parent on conflict)
   - Middleware can modify event severity (finalSeverity honored)

2. **Built-in Middleware Classes**:
   - `RedactSecretsMiddleware` - Enhanced with gofulmen-aligned defaults
   - `AddFieldsMiddleware` - Inject context fields into events
   - `TransformMiddleware` - Custom event transformations

**RedactSecretsMiddleware Enhancements**:

- **Gofulmen-Aligned Patterns** (cross-language consistency):
  - `SECRET_[A-Z0-9_]+` - Environment variable secrets
  - `[A-Z0-9_]*TOKEN[A-Z0-9_]*`, `[A-Z0-9_]*KEY[A-Z0-9_]*` - Token/key variants
  - `[A-Za-z0-9+/]{40,}={0,2}` - Base64 blobs (40+ characters)
  - `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` - Email addresses
  - `\b\d{13,19}\b` - Credit card numbers (13-19 digits)

- **Default Field Names** (case-insensitive):
  - password, token, apiKey, api_key, authorization, secret
  - cardNumber, card_number, cvv, ssn
  - accessToken, access_token, refreshToken, refresh_token

- **Performance Optimization**:
  - 10KB threshold: Pattern scanning skipped for strings >10KB
  - Field-based redaction (O(1) lookup) always applies
  - Pre-compiled regex patterns at construction
  - Case-insensitive map pre-computed for fast field matching

**Helper Function**: createStructuredLoggerWithRedaction()

- **Secure-by-Default**: Redaction enabled automatically
- **Customization Options**:
  - `customPatterns?: RegExp[]` - Add organization patterns
  - `customFields?: string[]` - Add application-specific field names
  - `useDefaultPatterns?: boolean` - Opt-out of defaults (default: true)
  - `filePath?: string` - Optional file output
- **Progressive Interface**: Simple → Structured → Structured+Redaction → Enterprise

**Child Logger Inheritance**:

- Child loggers inherit parent's middleware chain (exact same pipeline)
- Bindings merge: child bindings override parent on conflict
- Middleware executes identically for parent and child
- Guaranteed security: child of redacting logger always redacts

**Severity Adjustment**:

- Middleware can modify event severity via `finalSeverity`
- Use cases: downgrade noisy errors to warnings, upgrade critical info to error
- Honored by Pino logger for final emission

#### Documentation (863 lines total)

**Logging README** (src/logging/README.md - 789 lines):

- Complete middleware architecture documentation
- 35+ code examples covering all use cases
- API reference for all middleware classes and helpers
- Troubleshooting guide (4 scenarios with solutions)
- Migration guide (3 paths: simple → structured → secure)
- Performance section with 10KB threshold explanation
- Security model documentation (default-on redaction)
- Progressive interface guide (zero-complexity to enterprise)
- Policy enforcement documentation
- Cross-references to gofulmen and Crucible standards

**Main README Update** (74 lines):

- New "Progressive Logging" section with 3-level progression
- Before/after redaction output examples
- Security model callout (default-on redaction)
- Performance callout (10KB pattern-scan guard)
- Customization examples (custom patterns/fields, opt-out)
- Child logger inheritance documentation

#### Testing (121 total logging tests)

**Phase 3 Integration Tests** (12 new tests):

1. Helper creates logger with redaction middleware
2. Default field names (case-insensitive redaction)
3. Default redaction patterns (SECRET\_, TOKEN, Base64, emails, cards)
4. File output + redaction combination
5. Custom patterns override
6. Custom fields support
7. `useDefaultPatterns: false` disables defaults
8. Child loggers preserve redaction
9. Nested objects with redaction
10. Arrays with redaction
11. Email address redaction
12. Credit card number redaction

**Existing Test Coverage**:

- middleware.test.ts: 35 tests (Phase 1 - enhanced redaction)
- logger.test.ts: 28 tests (Phase 2 - middleware pipeline)
- create-logger.test.ts: 17 tests (5 existing + 12 new)
- policy.test.ts: 36 tests (existing)
- sinks.test.ts: 5 tests (existing)

#### Quality Gates: ✅ All Passing

- Tests: 1749 passing (102 test files)
- TypeCheck: Clean
- Lint: 35 pre-existing warnings (none from new code)
- Format: All files formatted (goneat + biome)
- Documentation: Comprehensive with 35+ examples

#### Implementation Phases

**Phase 1 - RedactSecretsMiddleware Enhancement** (Completed):

- Gofulmen-aligned patterns and field names
- Options object format (backward compatible)
- Pattern scanning with 10KB optimization
- 35 tests for middleware behavior

**Phase 2 - StructuredLogger Middleware Pipeline** (Completed):

- Middleware execution before Pino emission
- Child logger inheritance (middleware + bindings)
- Severity adjustment support
- 28 tests for logger pipeline

**Phase 3 - Helper Function & Integration** (Completed):

- createStructuredLoggerWithRedaction() with options
- 12 integration tests covering all scenarios
- Export from main logging module

**Phase 5 - Documentation** (Completed):

- Comprehensive logging README (789 lines)
- Main README Progressive Logging section
- 35+ code examples
- Troubleshooting and migration guides

#### Security Model

**Default-On Redaction**:

- `createStructuredLoggerWithRedaction()` enables redaction by default
- Gofulmen-aligned patterns protect common secrets automatically
- Opt-out available via `useDefaultPatterns: false` for full control

**Performance-Conscious**:

- 10KB threshold skips pattern scanning on large payloads
- Field-based redaction (O(1)) always applies
- Minimal middleware overhead (<5% typical)

**Cross-Language Consistency**:

- Patterns and field names match gofulmen
- Same secrets redacted across TypeScript, Go, Python

#### Breaking Changes

**None** - Additive feature, maintains full backward compatibility.

**Migration**: N/A (new feature, opt-in via helper function)

**Dependencies**: No new external dependencies

---

## [0.1.10] - 2025-11-17

### Critical Bugfix - Signal Catalog Path Resolution

**Release Type**: Critical Bugfix
**Status**: ✅ Released

#### Summary

Fixed critical bug from v0.1.9 where signal catalog loading failed in npm-installed packages due to incorrect path resolution after tsup bundling. Added runtime path detection and comprehensive pre-publish verification to prevent future occurrences.

#### Problem

v0.1.9 published successfully but catalog loading failed with:

```
FoundryCatalogError: Catalog signals not found or could not be loaded
```

Root cause: Source file at `src/foundry/signals/catalog.ts` used path `../../../config` (correct for source) but after tsup bundling into `dist/foundry/index.js`, this path pointed above package root.

#### Solution

**Runtime Path Detection** (src/foundry/signals/catalog.ts:20-34):

- Detects if running from `src/` (development) or `dist/` (production)
- Adjusts paths: `../../../config` for source, `../../config` for bundled
- Zero runtime overhead, works in both contexts

**Pre-Publish Verification** (scripts/verify-local-install.ts):

- Packs package locally with `npm pack`
- Installs to temp directory
- Tests catalog loading in installed context
- New Makefile target: `make verify-local-install`
- Added to publishing checklist (docs/publishing.md)

#### Changes

- Fixed path resolution in signals catalog loader
- Added pre-publish integration test script
- Updated publishing workflow documentation
- Deprecated v0.1.9 on npm with clear messaging
- All 1638 tests passing, local install verification passing

#### Testing

✅ All quality gates pass
✅ Local install verification passes (8 signals, 21 patterns loaded)
✅ Development mode works (running from source)
✅ Production mode works (running from dist/)

---

## [0.1.9] - 2025-11-16 [DEPRECATED]

> **⚠️ DEPRECATED**: This version has a critical bug where catalog loading fails in installed packages. Use v0.1.10 or later.

### Fulpack Module - Security-First Archive Operations

**Release Type**: New Module + Documentation
**Status**: ⚠️ Deprecated

#### Summary

Introduced complete fulpack module for security-first archive operations across four formats (TAR, TAR.GZ, ZIP, GZIP). Implements five canonical operations with comprehensive security checks, Pathfinder integration for archive discovery, and extensive documentation. Aligns with Crucible pathfinder extension patterns and FulmenHQ security standards.

#### New Module: @fulmenhq/tsfulmen/fulpack

**Five Canonical Operations**:

1. **create()** - Create archives from files/directories
   - Configurable compression levels (1-9)
   - Optional checksum generation (SHA-256, xxh3-128)
   - Pattern-based inclusion/exclusion
   - Symlink handling (follow/preserve)

2. **extract()** - Extract archives with security validation
   - Path traversal protection (rejects `../`, absolute paths)
   - Decompression bomb detection (size/ratio/entry limits)
   - Symlink safety validation
   - Overwrite policies (error/skip/overwrite)
   - Optional checksum verification

3. **scan()** - List archive contents without extraction
   - Performance target: <1s for TOC read
   - Returns normalized ArchiveEntry[] with metadata
   - Serves as Pathfinder integration backend
   - No security filtering (inspection only)

4. **verify()** - Validate archive integrity and security
   - Five security checks: structure_valid, no_path_traversal, symlinks_safe, no_decompression_bomb, checksums_verified
   - Returns structured ValidationResult with errors/warnings
   - Pre-extraction safety validation

5. **info()** - Quick archive metadata retrieval
   - Format detection and compression type
   - Entry count and size statistics
   - Compression ratio calculation
   - Checksum presence indicator

#### Four Archive Formats

- **TAR** (uncompressed) - Maximum speed for pre-compressed data
- **TAR.GZ** (gzip compression) - General purpose, best compatibility
- **ZIP** (deflate compression) - Windows compatibility, random access
- **GZIP** - Single file compression

#### Security Features

**Path Traversal Protection**:

- Rejects entries with `../` or absolute paths during extract/verify
- Included in scan() results for inspection
- Configurable via path constraints

**Decompression Bomb Detection**:

- Default limits: 1GB uncompressed, 100k entries
- Compression ratio warnings (>100:1)
- Configurable per-operation

**Symlink Safety**:

- Validates symlink targets stay within destination
- Not followed by default (security)
- Optional following with loop detection

**Checksum Verification**:

- Automatic verification during extraction
- Optional skip for trusted sources
- Integrated with fulhash module

#### Pathfinder Integration

- `scan()` serves as backend for archive file discovery
- Unified API across filesystem and archives
- Mixed queries (filesystem + archive sources)
- Example: `find({ source: "./data.tar.gz", pattern: "**/*.csv" })`

#### Documentation

**Comprehensive API Documentation** (src/fulpack/README.md):

- Complete reference for all 5 operations
- Security considerations and best practices
- Pathfinder integration patterns
- Format selection guide
- Error handling examples
- Performance optimization tips

**Main README Integration**:

- Added fulpack to Features list
- Added to Module Structure
- Comprehensive usage examples section

#### Test Coverage

**20 Tests Covering**:

- All 5 operations across all formats
- Security validation (path traversal, decompression bombs)
- Error handling and edge cases
- Overwrite policies
- Empty file detection
- Cross-format compatibility

#### Implementation Phases

**Phase 1 - Core Operations** (Completed):

- Implemented create() and extract() for all 4 formats
- Critical security hardening
- Error handling with FulpackOperationError
- 1612 tests passing

**Phase 2 - Scan & Verify** (Completed):

- Implemented scan() for TAR, TAR.GZ, ZIP, GZIP
- Enhanced verify() with 5 security checks
- Updated info() with real metadata from scan()
- All quality gates passed

**Phase 3 - Documentation** (Completed):

- Created comprehensive fulpack README (551 lines)
- Updated main README with usage examples
- Documented Pathfinder integration patterns
- Format selection and performance guides

#### Quality Metrics

- **Tests**: 20 fulpack tests, 1612 total tests passing
- **Coverage**: All operations and security checks
- **TypeScript**: Zero compilation errors
- **Lint/Format**: 100% clean (goneat assessment)
- **Documentation**: Complete API reference and examples

#### Breaking Changes

**None** - New module, no impact on existing APIs.

### Pathfinder Repository Root Discovery

**Release Type**: New Feature + Security Enhancement
**Target Version**: v0.1.9
**Status**: 🚧 In Progress

#### Summary

Implemented secure repository root discovery for pathfinder module, aligned with Crucible v0.2.15 extension spec. Provides upward directory traversal to find repository markers (.git, package.json, etc.) with comprehensive boundary enforcement and security checks. Replaces ad-hoc "walk-up" helpers with canonical, security-first API.

#### New API: findRepositoryRoot()

**Core Function**:

```typescript
findRepositoryRoot(startPath: string, markers?: string[], options?: FindRepoOptions): Promise<string>
```

**Predefined Marker Sets**:

- **GitMarkers**: `[".git"]`
- **NodeMarkers**: `["package.json", "package-lock.json"]`
- **PythonMarkers**: `["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"]`
- **GoModMarkers**: `["go.mod"]`
- **MonorepoMarkers**: `["lerna.json", "pnpm-workspace.yaml", "nx.json", "turbo.json", "rush.json"]`

**Helper Functions**:

- `withMaxDepth(n)` - Set maximum upward traversal depth
- `withBoundary(path)` - Set explicit boundary ceiling
- `withStopAtFirst(bool)` - Stop at first marker or find deepest
- `withConstraint(constraint)` - Add path constraint for additional security
- `withFollowSymlinks(bool)` - Enable symlink following with loop detection

#### Security Features

**Boundary Enforcement**:

- Default boundary: User home directory (if start path under home), otherwise filesystem root
- Explicit boundary: Validated as ancestor of start path
- Filesystem root stop: Automatic halt at POSIX root (/), Windows drives (C:\), UNC roots (\\server\share)
- Never traverses above boundary ceiling

**Path Constraints**:

- Optional workspace/repository boundary enforcement
- Rejects start paths outside constraint root
- Returns REPOSITORY_NOT_FOUND if constraint prevents marker discovery
- Prevents data leakage across workspace boundaries

**Symlink Safety**:

- Default: `followSymlinks=false` (security)
- Opt-in: `followSymlinks=true` with automatic loop detection
- Tracks visited real paths via `realpath()`
- Throws TRAVERSAL_LOOP error on cyclic symlinks

**Max Depth Protection**:

- Default: 10 levels of upward traversal
- Configurable per operation
- Prevents excessive filesystem traversal
- Terminates early on boundary/root/constraint hit

#### Implementation Details

**Search Behavior**:

- **stopAtFirst=true (default)**: Returns first marker found (closest to start path) - fast, typical use case
- **stopAtFirst=false**: Continues to deepest marker (closest to filesystem root) - monorepo root discovery

**Cross-Platform Support**:

- POSIX: Handles `/` root correctly
- Windows: Supports drive letters (C:\, D:\) and UNC paths (\\server\share)
- Path normalization: Uses `resolve()` for consistent path handling
- Boundary validation: Platform-aware `startsWith()` checks

**Error Codes** (Crucible-aligned):

- `REPOSITORY_NOT_FOUND`: No marker found within constraints (severity: medium)
- `INVALID_START_PATH`: Start path doesn't exist or isn't a directory (severity: high)
- `INVALID_BOUNDARY`: Boundary not an ancestor of start path (severity: high)
- `TRAVERSAL_LOOP`: Cyclic symlink detected when following enabled (severity: high)
- `SECURITY_VIOLATION`: Start path outside constraint root (severity: high)

#### Test Coverage

**26 Comprehensive Tests**:

- Basic marker detection (6 tests) - Single/multiple markers, parent directories
- Boundary enforcement (3 tests) - Explicit boundaries, validation, defaults
- Max depth limiting (2 tests) - Respect limits, find within depth
- Stop at first vs deepest (2 tests) - Nested repositories, monorepo roots
- Path constraints (3 tests) - Constraint enforcement, security violations
- Multiple markers (2 tests) - Priority order, fallback behavior
- Error handling (3 tests) - Invalid paths, non-directories, error context
- Filesystem root handling (1 test) - Stop at root detection
- Edge cases (3 tests) - Empty markers, special characters, path normalization

**All tests passing** with proper error code validation and cross-platform path handling.

#### Documentation

**Complete pathfinder README.md**:

- Quick start examples with all marker sets
- API reference with full parameter documentation
- Default behavior documentation (with override examples)
- Safe usage patterns (boundary + constraint, stopAtFirst=false for monorepo)
- Cross-platform behavior guide (POSIX/Windows/UNC)
- Symlink handling documentation (security-first, opt-in)
- Error mapping table with severity and context details
- Performance considerations and best practices
- Security considerations and data leakage prevention
- Migration guide from ad-hoc helpers

#### Quality Metrics

- **Tests**: 1638 total (+26 new pathfinder tests)
- **TypeScript**: Zero compilation errors
- **Lint/Format**: 100% clean (goneat assessment)
- **Documentation**: Complete API reference and security guide
- **Code Coverage**: All paths covered (security, errors, edge cases)

#### Migration Path

**Identified Ad-hoc Helper**:

- `src/appidentity/discovery.ts:searchAncestors()` (lines 98-120)
- Can be refactored to use `findRepositoryRoot()` for consistency and better security

**Before** (ad-hoc):

```typescript
async function searchAncestors(startDir: string): Promise<string | null> {
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (await fileExists(join(currentDir, ".fulmen/app.yaml")))
      return currentDir;
    currentDir = dirname(currentDir);
  }
  return null;
}
```

**After** (pathfinder):

```typescript
const root = await findRepositoryRoot(startDir, [".fulmen"]);
// Includes boundary enforcement, security checks, better error messages
```

#### Breaking Changes

**None** - New API, no impact on existing code.

#### Migration Notes

**For Future Work**:

- Refactor `searchAncestors()` in appidentity to use `findRepositoryRoot()`
- fulhash checksum integration for fulpack planned for later phase
- Symlink extraction support for fulpack (currently validates only) planned for enhancement

---

## [0.1.8] - 2025-11-08

### Remote Sync Implementation & Goneat Upgrade

**Release Type**: Infrastructure Upgrade + Quality Improvements  
**Release Date**: November 8, 2025  
**Status**: ✅ Ready for Release

#### Summary

Implemented enterprise-grade remote-only sync infrastructure by upgrading goneat to v0.3.4 and migrating from deprecated `method: remote` to `force_remote: true` configuration. This release ensures reproducible builds regardless of local directory structure and strengthens the SSOT synchronization framework.

#### Infrastructure Changes

**Goneat Upgrade** (v0.3.3 → v0.3.4):

- Updated `.goneat/tools.yaml` with correct GitHub API checksums
- Verified proper installation and bootstrap functionality
- Enhanced tool verification with SHA256 checksum validation

**Remote-Only Sync Implementation**:

- Migrated `.goneat/ssot-consumer.yaml` from deprecated `method: remote` to `force_remote: true`
- Added `--force-remote` flag protection in `Makefile sync-ssot` target
- Confirmed provenance shows `forced_remote: true` and `forced_by: "flag"`
- Pinned to Crucible v0.2.8 with `method: "git_ref"`

#### Quality Improvements

**Verification Tooling Fixes**:

- Fixed TypeScript errors in `scripts/verify-published-package.ts`:
  - Corrected `tmpdir` import from default to named import
  - Fixed `run()` function return type for `Buffer | string` handling
  - Added `'ignore'` to stdio type union
  - Fixed missing `await` on `getSignalsVersion()` call
- Removed unused `existsSync` import

**Comprehensive Test Coverage**:

- Created `scripts/__tests__/verify-published-package.test.ts` with 5 tests:
  1. TypeScript compilation validation
  2. Async/await usage verification
  3. VERSION export validation
  4. Cleanup logic verification
  5. Stdio options validation
- Fixed `src/__tests__/build-artifacts.test.ts` to run `make build` before expecting `dist/` files

#### Build System Enhancements

**Makefile Protection**:

- Enhanced `sync-ssot` target with `--force-remote` flag
- Ensures remote-only sync behavior cannot be bypassed
- Integrated with existing quality gate workflow

**Bootstrap Reliability**:

- Verified goneat v0.3.4 installation via tools.yaml
- Confirmed hooks execute properly with local binary
- Added checksum verification for tool integrity

#### Quality Metrics

- **Tests**: 1,569 passing (+99 new tests from remote sync validation)
- **TypeScript**: Zero compilation errors
- **Build**: Successful artifact generation with remote sync
- **Sync**: Force-remote configuration verified and operational
- **Coverage**: Verification tooling now has comprehensive test coverage

#### Enterprise Benefits

**Reproducible Builds**:

- Remote-only sync eliminates local directory structure dependencies
- Consistent SSOT content across all development environments
- Pinned to specific Crucible version (v0.2.8) for stability

**Enhanced Security**:

- Checksum-verified tool downloads
- Force-remote prevents accidental local overrides
- Provenance tracking with audit trail

#### Breaking Changes

**None** - All changes are infrastructure improvements and maintain full API compatibility.

---

## Archived Releases

Older releases (v0.1.7 and earlier) have been archived to `docs/releases/v{version}.md`.

See:

- `docs/releases/v0.1.7.md` - Version Consistency & Release Infrastructure
- `docs/releases/v0.1.6.md` - Skipped (VERSION constant mismatch)
- `docs/releases/v0.1.5.md` - Application Identity, Signal Handling & Performance Optimization
- `docs/releases/v0.1.3.md` - Schema Registry & Validation Infrastructure
- `docs/releases/v0.1.2.md` - FulHash Module & Foundry Enhancements

---

**Last Updated**: November 18, 2025
**Next Review**: After v0.1.11 release

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md`.
