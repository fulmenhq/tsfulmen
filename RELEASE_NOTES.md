# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

---

## [0.1.14] - 2025-11-20

**Release Type**: Bug Fix + Infrastructure
**Status**: ✅ Released

### Critical Packaging Fix & Verification Hardening

**Summary**: Fixed a critical packaging issue in v0.1.13 where the new `crucible/fulpack` module was not exported, making it inaccessible to consumers. Hardened the release process with enhanced verification scripts to prevent recurrence.

#### Fixed

- **Missing Export**: Added missing `crucible/fulpack` module to `tsup.config.ts` and `package.json` exports. This ensures the module is correctly built and reachable.

#### Infrastructure Improvements

- **Enhanced Verification**: Updated `scripts/verify-published-package.ts` (post-publish) and `scripts/verify-local-install.ts` (pre-publish) to:
  - Verify `config` module loading
  - Verify `crucible/fulpack` module export reachability
  - Smoke test app identity and signals functionality
- **Documentation**: Updated `docs/publishing.md` with explicit instructions for developers to update verification scripts when adding new modules.

#### Quality Gates

- **Tests**: All 1755 tests passing
- **Verification**: `make verify-local-install` passes with new module checks
- **Validation**: `make validate-all` passes

---

**Release Type**: New Feature + SSOT Update
**Status**: ✅ Released

### Enterprise Configuration Loading

**Summary**: Implements the Fulmen Forge Workhorse "Three-Layer Configuration" pattern, providing a standardized, secure, and type-safe way to load application configuration.

#### New Features: @fulmenhq/tsfulmen/config

**Three-Layer Loading Architecture**:

1. **Defaults Layer** (Required): Base configuration loaded from a distributed YAML/JSON file.
2. **User Config Layer** (Optional): Overrides loaded from XDG-compliant user directories (e.g., `~/.config/myapp/config.yaml`).
   - Supports `.yaml`, `.yml`, `.json` formats
   - Resolves paths using platform standards (XDG on Linux, AppData on Windows, Library on macOS)
3. **Environment Layer** (Optional): Overrides loaded from environment variables with prefix support.
   - Automatic type coercion (strings "true"/"false" -> boolean, numeric strings -> number)
   - Nesting support via underscores (e.g., `MYAPP_SERVER_PORT` -> `server.port`)

**Schema Validation**:

- Integrated AJV validation against Crucible-compliant schemas
- activated by providing `schemaPath` option
- Returns typed `ConfigValidationError` with detailed diagnostics on failure

**Metadata & Observability**:

- Returns `ConfigMetadata` object alongside configuration
- Tracks active layers (`["defaults", "user", "env"]`)
- Reports resolved paths for debugging
- Confirms validation status

**Usage**:

```typescript
const { config, metadata } = await loadConfig<AppConfig>({
  identity, // from AppIdentity module
  defaultsPath: join(__dirname, "defaults.yaml"),
  schemaPath: join(__dirname, "schema.json"), // Optional
});
```

### SSOT Updates

- **Crucible v0.2.19**: Updated to latest Single Source of Truth
  - Synced latest schemas and configuration definitions
  - Updated documentation standards

### Quality Gates

- **Tests**: 1755 tests passing (+6 new config loader tests)
- **Coverage**: 100% coverage for new configuration loader module
- **Type Safety**: Strict TypeScript compliance

---

## [0.1.12] - 2025-11-18

**Release Type**: Bug Fix + Quality Infrastructure
**Status**: ✅ Released

### Package Integrity Validation + Telemetry Export Fix

**Critical Fix**: Resolved v0.1.11 packaging issue where `telemetry/http` and `telemetry/prometheus` modules were not built despite being documented. Fixed `tsup.config.ts` and `package.json` to include submodule entries.

**New Infrastructure**: Six automated validation scripts prevent incomplete packages from being published:

- `validate-exports.ts` - Verifies package.json exports exist in dist/
- `validate-tsup-config.ts` - Ensures tsup/package.json alignment
- `validate-source-modules.ts` - Detects unmapped source modules
- `validate-package-contents.ts` - Validates npm pack structure
- `validate-imports.ts` - Simulates consumer imports
- `validate-types.ts` - Verifies .d.ts completeness

Integrated into `prepublishOnly` hook and Makefile (`make validate-all`). All validations pass in < 5 seconds.

**Type Safety Enhancement**: Improved HTTP middleware with proper framework types:

- Added optional peerDependencies for `@types/express` and `fastify`
- Created `src/telemetry/http/types.ts` with cross-framework interfaces
- Replaced 13 undocumented `any` with typed Express/Fastify/Bun signatures
- Full TypeScript autocomplete for framework request/response objects

**Testing**: All 1749 tests passing. Quality gates: ✅ lint, ✅ typecheck, ✅ validate-all

**Documentation**: Complete release notes in `docs/releases/v0.1.12.md`

---

## [0.1.11] - 2025-11-17

### HTTP Server Metrics

**Release Type**: New Feature
**Status**: ✅ Released (Superseded by v0.1.12 - see above for export fix)

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

**Archive Policy**: This file maintains the **last 3 released versions** plus unreleased work. Older releases are archived in `docs/releases/v{version}.md`.
