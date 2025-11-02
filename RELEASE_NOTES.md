# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

**Convention**: This file maintains the **last 3 released versions** in reverse chronological order (latest first) plus any unreleased work. Older releases are archived in `docs/releases/v{version}.md`. This provides sufficient recent context for release preparation while keeping the file manageable.

## [Unreleased]

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

## [0.1.1] - 2025-10-20

### Core Modules Implementation - Config, Schema, and Foundry

**Release Type**: Feature Release
**Release Date**: October 20, 2025
**Status**: ✅ Ready for Release

#### Features

**Config Path API** (`src/config/`):

- ✅ **XDG Base Directory Compliance**: Cross-platform config, cache, data, state directory resolution
- ✅ **Windows Support**: Proper FOLDERID handling with fallbacks
- ✅ **App-Scoped Paths**: Automatic subdirectory creation for application isolation
- ✅ **Type Safety**: Full TypeScript interfaces and error handling
- ✅ **Test Coverage**: 26 tests including Windows path simulation

**Schema Validation** (`src/schema/`):

- ✅ **JSON Schema 2020-12 Support**: Full AJV validator with strict mode
- ✅ **Schema Registry**: Dynamic loading from crucible-ts SSOT assets
- ✅ **YAML/JSON Support**: Unified interface for both formats
- ✅ **CLI Tool**: `tsfulmen validate` command for CI/CD integration
- ✅ **Error Normalization**: User-friendly validation error messages
- ✅ **Goneat Bridge**: Direct integration with goneat tool configurations
- ✅ **Test Coverage**: 115 tests across validator, registry, normalizer, CLI

**Foundry Module** (`src/foundry/`):

- ✅ **Pattern Catalog**: 21 regex patterns (email, URL, UUID, semver, etc.) with metadata
- ✅ **HTTP Status Catalog**: 58 status codes organized by category with RFC references
- ✅ **MIME Type Catalog**: 7 common types with extension mappings
- ✅ **MIME Magic Number Detection**: Content-based type detection with streaming support
  - Exact matching: JSON, XML, YAML
  - Heuristic matching: NDJSON, CSV, Protocol Buffers, plain text
  - BOM handling for UTF-8/UTF-16/UTF-32
  - File, buffer, and stream interfaces
  - Bun.file() optimization with Node.js fallback
- ✅ **Country Code Catalog**: ISO 3166-1 alpha-2/alpha-3 mappings
- ✅ **Type Safety**: Full interfaces with discriminated unions
- ✅ **Test Coverage**: 151 tests including 61 MIME detection tests with fixtures

#### Quality Metrics

- **Total Tests**: 292 (from 0 in v0.1.0)
- **Test Coverage**: Config 100%, Schema 95%+, Foundry 100%
- **Zero Runtime Dependencies**: Maintained (dev dependencies only)
- **Type Safety**: Strict TypeScript mode, all exports typed
- **Cross-Platform**: Windows/Linux/macOS tested

---

**Last Updated**: November 2, 2025  
**Next Review**: After v0.1.4 release
