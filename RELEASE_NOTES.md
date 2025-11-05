# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

---

## [0.1.5] - 2025-11-05

### Application Identity, Signal Handling & Performance Optimization

**Release Type**: Major Feature Release + Performance Optimization
**Release Date**: November 5, 2025
**Status**: ✅ Ready for Release

#### Summary

Complete application identity and signal handling modules implementing Crucible v0.2.6 standards, plus significant FulHash performance optimization (22x improvement for small inputs). This release delivers enterprise-grade application lifecycle management with graceful shutdown, config reloading, and cross-platform signal handling.

#### Features

**Application Identity Module** (`src/appidentity/`) - ✅ **Completed**

- **3-Tier Discovery Algorithm**: Explicit path → `FULMEN_APP_IDENTITY_PATH` env var → ancestor search (20-level limit)
- **Process-Level Caching**: Singleton cache with immutability guarantees via deep freezing
- **8 Helper Functions**: `getBinaryName()`, `getVendor()`, `getEnvPrefix()`, `buildEnvVar()`, `getEnvVar()`, etc.
  - Character normalization for environment variable names (`[^A-Z0-9_]` → `_`)
- **CLI Commands**: `identity-show` and `identity-validate` with proper exit codes (0, 51, 60)
- **Parity Verification**: Cross-language snapshot validation (9/9 tests passing)
- **Test Coverage**: 93 test cases, 96.09% line coverage

**Signal Handling Module** (`src/foundry/signals/`) - ✅ **Completed**

- **Cross-Platform Signal Catalog**: Canonical signal definitions from Crucible Foundry (v1.0.0)
  - POSIX signal support with behavior metadata (exit codes, default actions, retry hints)
  - Windows fallback strategy with structured logging and HTTP endpoint guidance
- **Signal Manager**: Enterprise-grade handler registration and lifecycle management
  - FIFO execution with optional priority overrides, per-handler timeouts (30s default)
  - Comprehensive observability via progressive logger and telemetry (`fulmen.signal.*`)
- **Double-Tap Logic**: Ctrl+C debounce with configurable window (2s default, exit 130 on force)
- **Config Reload Helper**: Schema-validated configuration reloading via SIGHUP
- **HTTP Endpoint Helper**: Framework-agnostic POST /admin/signal handler with auth/rate-limiting
- **Convenience Wrappers**: `onShutdown()`, `onReload()`, `onUSR1()`, `onUSR2()`, `onEmergencyQuit()`
- **CLI Commands**: `signals show`, `signals validate`, `signals platform` for catalog exploration and debugging
- **Makefile Targets**: `make validate-signals` and `make verify-signals-parity` integrated into quality gates
- **Test Coverage**: 180 test cases covering parity, unit, and integration scenarios

#### Performance Improvements

**FulHash Small Input Optimization** - ✅ **Completed**

- **22x Performance Improvement**: 0.132ms → 0.006ms per operation (182,265 ops/sec)
- **Root Cause Fixed**: Eliminated WASM initialization overhead by using cached `xxhash128()` helper
- **XXH3-128 Now Faster Than SHA-256**: Corrected performance inversion (was 15x slower, now 2x faster)
- **Large Input Performance**: Maintained at >4 GB/s throughput
- **Streaming Consistency**: Variance improved from ±97% to ±5%
- **Zero Regressions**: All 1,465 tests passing

**Benchmarks** (10,000 operations, 28 bytes each):

- Before: 1,321ms total (7,570 ops/sec)
- After: 57ms total (182,265 ops/sec)
- Improvement: 23x faster

See `.plans/active/v0.1.5/fulhash-performance-comparison.md` for detailed analysis.

#### Quality Metrics

- **Test Coverage**: 1,465 tests passing (93 appidentity + 180 signals tests)
- **Quality Gates**: All `make check-all` checks passing (100% pass rate)
- **Type Safety**: Zero TypeScript errors with strict mode
- **Linting**: Zero Biome warnings
- **Performance**: FulHash benchmarks stable and consistent
- **Cross-Language Parity**: App identity and signals compatible with pyfulmen/gofulmen

#### Breaking Changes

**None** - All changes are additive or internal optimizations. Existing APIs remain unchanged.

---

## [0.1.3] - 2025-11-02

### Pathfinder Module - Enterprise Filesystem Traversal

**Release Type**: Feature Release  
**Release Date**: November 2, 2025  
**Status**: ✅ Ready for Release

#### Summary

Complete Pathfinder filesystem traversal module with enterprise observability, checksum integration, and comprehensive pattern matching. This release delivers 44 tests with 111 assertions, providing production-ready filesystem discovery with TSFulmen's signature enterprise features. **All core modules are now implemented** - TSFulmen has achieved full module parity with the Fulmen Helper Library Standard.

#### Features

**Pathfinder Module** (`src/pathfinder/`) - ✅ **Completed**

- **Core Traversal Engine**: Recursive directory scanning with glob pattern matching
  - `includePatterns` and `excludePatterns` for flexible file selection
  - `maxDepth` control for traversal depth limiting
  - `followSymlinks` and `includeHidden` for advanced filesystem access
  - Streaming results via `findIterable()` for memory-efficient large directory processing
  - **Tests**: 18 integration tests with real filesystem operations

- **Ignore File Support**: `.fulmenignore` and `.gitignore` with nested precedence
  - Hierarchical ignore pattern loading from directory tree
  - Child directory patterns override parent directory rules
  - Configurable via `honorIgnoreFiles: boolean`
  - **Tests**: 4 tests covering ignore file scenarios

- **FulHash Integration**: Optional streaming checksum calculation
  - Algorithms: `xxh3-128` (default) and `sha256` support
  - Streaming implementation prevents memory exhaustion on large files
  - Checksum errors handled gracefully with error metadata preservation
  - Performance verified: `<10% overhead` with checksums enabled
  - **Tests**: 4 tests covering both algorithms and error handling

- **Path Constraints**: Security-focused path validation with enforcement levels
  - `EnforcementLevel.STRICT`: Reject violations with FulmenError
  - `EnforcementLevel.WARN`: Log warnings and continue operation
  - `EnforcementLevel.PERMISSIVE`: No enforcement (default)
  - Path traversal attack prevention with root boundary enforcement
  - `allowedPrefixes` and `forbiddenPatterns` for fine-grained control
  - **Tests**: 8 tests covering security scenarios and constraint enforcement

- **Enterprise Observability**: Full integration with TSFulmen infrastructure
  - Structured `FulmenError` with correlation IDs and severity levels
  - Telemetry metrics: `pathfinder_find_ms`, `pathfinder_security_warnings`
  - Progressive logging integration with policy-driven profiles
  - Schema validation via existing TSFulmen schema module
  - **Tests**: 4 observability integration tests

- **Convenience Helpers**: Pre-configured finders for common use cases
  - `findConfigFiles()`: Discover YAML/JSON configuration files
  - `findSchemaFiles()`: Find `.schema.json` and `.schema.yaml` files
  - `findByExtensions()`: Generic extension-based file discovery
  - **Tests**: 3 tests covering all convenience helpers

- **PathfinderOptions Integration**: Enterprise-grade configuration interface
  - `logger`: Integration with TSFulmen progressive logging system
  - `correlationId`: Distributed tracing support across operations
  - `metrics`: Custom metrics registry support
  - Full TypeScript type safety with exported `PathfinderOptions` interface

- **Cross-Platform Support**: Linux, macOS, Windows compatibility
  - Path normalization and separator handling
  - Symlink resolution consistent across platforms
  - Windows-specific path length and character constraints

#### Quality Metrics

- **Test Coverage**: 44 tests with 111 assertions
- **Quality Gates**: All `make check-all` checks passing
- **Type Safety**: Zero TypeScript errors with strict mode
- **Linting**: Zero Biome warnings
- **Performance**: <10% overhead with checksums enabled
- **Cross-Language Parity**: Compatible with pyfulmen/gofulmen Pathfinder APIs

#### Enterprise Integration

- **Error Handling**: All operations emit structured `FulmenError` on failure
- **Telemetry**: Automatic metric emission per TSFulmen taxonomy
- **Logging**: Progressive profile support with correlation ID propagation
- **Schema Validation**: Uses existing TSFulmen schema module for config validation
- **Checksum Integration**: Leverages proven FulHash module from v0.1.2

#### Breaking Changes

**None** - This is a pure addition release. All existing APIs remain unchanged.

---

## [0.1.2] - 2025-10-25

### Error Handling, Telemetry, and Core Utilities

**Release Type**: Feature Release  
**Release Date**: October 25, 2025  
**Status**: ✅ Ready for Release

#### Summary

Major capability expansion with error handling, telemetry, hashing, document processing, progressive logging, and complete Crucible integration. This release delivers 6 major modules with 564 new lines of production code and 520 lines of test code, bringing total test count to 981/991 passing.

#### Features

**Error Handling Module** (`src/errors/`) - ✅ **Completed**

- **Schema-backed FulmenError** with immutable data structure
- Static constructors: `fromError()`, `wrap()`, `fromData()`
- Correlation ID support for distributed tracing
- Severity levels with numeric mapping
- Exit code guidance for CLI applications
- Type guards and validators
- **Tests**: 43 tests covering all error operations
- **Package Export**: `@fulmenhq/tsfulmen/errors`

**Telemetry Module** (`src/telemetry/`) - ✅ **Completed**

- **Counter, Gauge, Histogram** metric types
- ADR-0007 compliant histogram buckets for `_ms` metrics
- Global registry with `metrics.counter()`, `metrics.gauge()`, `metrics.histogram()`
- OTLP-compatible JSON export
- Taxonomy integration from `config/crucible-ts/taxonomy/metrics.yaml`
- **Tests**: 85 tests covering all metric types
- **Package Export**: `@fulmenhq/tsfulmen/telemetry`

**Telemetry Instrumentation** - ✅ **Completed**

- **Config Module**: `config_load_ms` histogram, `config_load_errors` counter (7 tests)
- **Schema Module**: `schema_validations`, `schema_validation_errors` counters (9 tests)
- **Crucible Module**: `foundry_lookup_count` counter (8 tests)
- **Zero Breaking Changes**: All error types unchanged
- **Taxonomy Compliant**: All metrics defined in Crucible SSOT
- **Tests**: 24 telemetry integration tests

**FulHash Module** (`src/fulhash/`) - ✅ **Completed**

- **XXH3-128**: Fast non-cryptographic hashing with streaming support
- **SHA-256**: Cryptographic hashing for integrity verification
- **Streaming API**: Memory-efficient processing for large files
- **WASM Backend**: High-performance implementations via `@3leaps/fulhash-wasm`
- **Type Safety**: Full TypeScript interfaces with algorithm discrimination
- **Tests**: 157 tests including benchmarks and concurrency validation
- **Package Export**: `@fulmenhq/tsfulmen/fulhash`

**Progressive Logging** (`src/logging/`) - ✅ **Completed**

- **Policy-driven profiles**: `minimal`, `default`, `verbose`, `debug`
- **Pino integration**: High-performance JSON logging with redaction
- **Sink architecture**: Console, file, and custom sink support
- **Correlation ID propagation**: Automatic context preservation
- **Middleware system**: Pluggable log processing pipeline
- **Tests**: 83 tests covering profiles, sinks, and middleware
- **Package Export**: `@fulmenhq/tsfulmen/logging`

**Crucible Shim** (`src/crucible/`) - ✅ **Completed**

- **Complete SSOT integration**: Schemas, docs, and config defaults
- **Type-safe discovery**: Runtime type checking for all assets
- **Version normalization**: Semantic version handling with validation
- **Error handling**: Structured errors with correlation IDs
- **Performance**: <250ms full discovery benchmark
- **Tests**: 96 tests across discovery, docs, schemas, configs, versions
- **Package Export**: `@fulmenhq/tsfulmen/crucible`

**DocScribe** (`src/docscribe/`) - ✅ **Completed**

- **Frontmatter parsing**: YAML metadata extraction from markdown
- **Header extraction**: H1-H6 hierarchy with anchor generation
- **Content splitting**: Document segmentation for processing
- **Format normalization**: Consistent markdown formatting
- **Tests**: 50+ tests covering parsing, splitting, and formatting
- **Package Export**: `@fulmenhq/tsfulmen/docscribe`

#### Quality Metrics

- **Total Tests**: 991 (981 passing, 98.0% pass rate)
- **New Production Code**: 564 lines
- **New Test Code**: 520 lines
- **Zero Runtime Dependencies**: Maintained (dev dependencies only)
- **All Quality Gates**: ✅ `make check-all` passing

---

**Last Updated**: November 5, 2025  
**Next Review**: After v0.1.6 release

**Archive**: Older releases are archived in `docs/releases/v{version}.md`
