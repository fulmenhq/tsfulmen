# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.1.7] - 2025-11-06

**Release Infrastructure** - Automated version consistency checks and workflow improvements to prevent version drift.

### Fixed

- **VERSION Constant Drift**: VERSION exported from code now automatically synchronized with package.json
  - Enhanced `scripts/version-sync.ts` to update `src/index.ts` VERSION constant
  - Added VERSION consistency verification to `scripts/verify-package-artifacts.ts`
  - Prevents mismatch between package.json version and runtime VERSION export (issue found in v0.1.6)

### Changed

- **Makefile Improvements**:
  - Updated `prepush` target to run `fmt` before `check-all`
  - Ensures formatting is applied before quality checks
- **Bootstrap Process**: Verified `./bin/goneat` installation via tools.yaml download method works correctly

### Infrastructure

- Pre-publish artifact verification now validates VERSION consistency
- Automated version synchronization across package.json and source code
- Improved release workflow to catch version drift issues early

**Note**: v0.1.6 was published to npm but had VERSION constant mismatch (package.json: 0.1.6, exported: 0.1.5). GitHub release v0.1.6 was removed. This release fixes that infrastructure gap.

---

## [0.1.6] - 2025-11-06

**Skipped** - Published to npm but not released on GitHub due to VERSION constant mismatch discovered post-publish. See v0.1.7 for details and fixes.

### Issues

- VERSION constant exported `'0.1.5'` while package.json declared `0.1.6`
- GitHub release removed; npm package remains but is not recommended
- Users should upgrade to v0.1.7 or later

---

## [0.1.5] - 2025-11-05

**Application Identity Module** - Complete implementation of Crucible app-identity standard v1.0.0 with discovery, caching, validation, and CLI tooling.

### Added

- **App Identity Module** (`@fulmenhq/tsfulmen/appidentity`)
  - **Core Functions**: `loadIdentity()`, `getCachedIdentity()`, `clearIdentityCache()`
  - **Discovery Algorithm**: 3-tier precedence (explicit path → `FULMEN_APP_IDENTITY_PATH` → ancestor search)
    - Configurable max search depth (20 ancestors default)
    - Rich error messages with searched paths
  - **Schema Validation**: Validates against `app-identity/v1.0.0` schema via existing registry
    - Deep freezing for immutability (custom `deepFreeze()` utility)
    - Optional validation bypass for test scenarios
  - **Helper Functions**: 8 convenience accessors
    - `getBinaryName()`, `getVendor()`, `getEnvPrefix()`, `getConfigName()`
    - `getTelemetryNamespace()` with fallback to binary_name
    - `getConfigIdentifiers()` returns frozen tuple for config paths
    - `buildEnvVar()` with character normalization (`[^A-Z0-9_]` → `_`)
    - `getEnvVar()` with default value support
  - **Process-Level Caching**: Singleton cache with `skipCache` option
  - **Test Injection**: `identity` parameter bypasses filesystem and validation
  - **CLI Commands**: `identity-show` and `identity-validate`
    - Pretty and JSON output formats
    - Proper exit codes (0, 51, 60) per Foundry catalog
  - **Makefile Integration**:
    - `make validate-app-identity` - Quick validation
    - `make verify-app-identity-parity` - Cross-language parity check
  - **Parity Verification**: `scripts/verify-app-identity.ts` validates against Crucible snapshot
    - 9 test cases (4 valid + 5 invalid)
    - Stricter error type matching (fails on type mismatch)
  - **Comprehensive Testing**: 93 test cases, 96.09% line coverage
    - Type inference, discovery precedence, caching behavior
    - Schema validation, error handling, CLI exit codes
    - All fixtures from Crucible v0.2.4

- **Signal Handling Module** (`@fulmenhq/tsfulmen/foundry/signals`)
  - **Signal Catalog**: Load and query Crucible's canonical signal definitions (POSIX + Windows)
    - `getSignalsVersion()`, `listSignals()`, `getSignal()`, `listBehaviors()`, `getBehavior()`
    - Full behavior metadata (exit codes, default actions, retry hints, OS mappings)
  - **Platform Capabilities**: Runtime detection and guards
    - `isPOSIX()`, `isWindows()`, `supportsSignal()`, `supportsSignalExitCodes()`
    - `ensureSupported()`, `ensurePOSIX()`, `ensureWindows()` with actionable errors
  - **Signal Manager**: Registration and lifecycle management
    - `createSignalManager()` with FIFO execution, priority overrides, timeout enforcement (30s default)
    - `register()`, `unregister()`, `trigger()`, `shutdown()`, `isRegistered()`
    - Comprehensive logging and telemetry (`fulmen.signal.*` events)
  - **Windows Fallback**: Structured guidance for unsupported signals
    - `handleWindowsFallback()` logs at INFO, emits telemetry, returns no-op registration
    - `getHttpFallbackGuidance()` provides HTTP endpoint scaffolding instructions
  - **Double-Tap Logic**: Ctrl+C debounce with configurable window (2s default)
    - `createDoubleTapTracker()`, `handleDoubleTap()`, immediate exit on second tap (exit 130)
  - **Convenience Wrappers**: Common signal patterns
    - `onShutdown()` (SIGTERM/SIGINT), `onReload()` (SIGHUP), `onUSR1()`, `onUSR2()`
    - `onEmergencyQuit()` (SIGQUIT), `onAnyShutdown()` (all shutdown signals)
  - **Config Reload Helper**: Schema-validated configuration reloading
    - `createConfigReloadHandler()` validates via TSFulmen schema module before restart
    - `ConfigReloadTracker` tracks reload attempts, successes, failures
  - **HTTP Endpoint Helper**: Framework-agnostic signal triggering via HTTP
    - `createSignalEndpoint()` - POST /admin/signal handler with auth/rate-limiting hooks
    - `createBearerTokenAuth()`, `createSimpleRateLimiter()` - production-ready examples
    - Platform-aware: serves Windows deployments, enhances POSIX observability
  - **Comprehensive Testing**: 180 test cases covering all modules
    - Parity tests against Crucible fixtures and snapshot
    - Unit tests for manager, timeout, priority, double-tap, platform detection
    - Integration tests for config reload, HTTP helper, concurrency

### Changed

- **buildEnvVar**: Now normalizes invalid characters (hyphens, dots, etc.) to underscores
- **Exit Codes**: Fixed SIGUSR1/SIGUSR2 codes to use BSD values (159/160) for platform consistency
  - Examples:
    - `'database-url'` → `'MYAPP_DATABASE_URL'`
    - `'my.config'` → `'MYAPP_MY_CONFIG'`
- **CLI Entry Point**: Added main execution block to `src/schema/cli.ts`
- **Version**: Bumped to 0.1.5 across all metadata

### Performance

- **FulHash Small Input Optimization** (22x faster)
  - One-shot XXH3-128 operations now use cached `xxhash128()` helper from hash-wasm
  - Small input performance: 0.132ms → 0.006ms per operation (182,265 ops/sec)
  - XXH3-128 now correctly outperforms SHA-256 for all input sizes
  - Large input throughput maintained (>4 GB/s)
  - Streaming API consistency improved (variance reduced from ±97% to ±5%)
  - See `.plans/active/v0.1.5/fulhash-performance-comparison.md` for detailed benchmarks

### Documentation

- **README.md**: Added Application Identity section with usage examples
- **docs/tsfulmen_overview.md**: Updated module catalog with app-identity entry
- **docs/crucible-ts/guides/consuming-crucible-assets.md**: Added identity integration examples
- **AGENTS.md**: Added caveat about `bun test` vs `bun run test`

### Dependencies

- Synced with Crucible v0.2.4 app-identity schema and fixtures
- No new external dependencies

---

## [0.1.3] - 2025-11-01

**Foundry Similarity v2.0.0** - Major upgrade to similarity module with multiple distance metrics, normalization presets, WASM-backed performance, and Turkish locale support.

### Added

- **Similarity v2.0.0**: Complete implementation of Crucible Foundry Similarity Standard v2.0.0
  - **Multiple Metrics**: Five distance/similarity algorithms
    - Levenshtein distance (Wagner-Fischer)
    - Damerau-Levenshtein OSA (Optimal String Alignment)
    - Damerau-Levenshtein unrestricted (true Damerau)
    - Jaro-Winkler similarity with prefix scaling
    - Longest common substring (LCS)
  - **Normalization Presets**: Four standardized text normalization levels
    - `none`: No transformation
    - `minimal`: NFC + trim
    - `default`: NFC + casefold + trim
    - `aggressive`: NFKD + casefold + strip accents + remove punctuation
  - **Turkish Locale Support**: Proper İ/i handling via `@3leaps/string-metrics-wasm` v0.3.8
  - **Rich Suggestion API**: Enhanced metadata in suggestion results
    - `matchedRange`: Character positions for substring matches
    - `reason`: Score explanation strings
    - `normalizedValue`: Post-normalization text
  - **WASM Performance**: 4x faster than pure TypeScript implementation
    - Levenshtein: 0.0028ms avg (was 0.059ms)
    - Score: 0.0022ms avg (was 0.058ms)
    - <1ms p95 target exceeded: 0.004ms p95
  - **Comprehensive Testing**: 143 tests including fixture-driven validation
    - 76 fixture tests against Crucible v2.0.0 standard
    - 67 unit and integration tests
    - Build artifacts test prevents WASM bundling

### Changed

- **Similarity API**: Metric parameter added to distance/score functions
  - `distance(a, b, metric?)` - specify algorithm
  - `score(a, b, metric?)` - normalized similarity with metric selection
  - Backward compatible: defaults to `"levenshtein"`
- **Normalization API**: Preset-based interface with backward compatibility
  - `normalize(value, preset?, locale?)` - preset string parameter
  - Legacy `normalize(value, options)` still supported
  - Enhanced with locale parameter for Turkish/Lithuanian/Azeri
- **Suggestion Options**: Extended with v2 parameters
  - `metric`: Algorithm selection
  - `normalizePreset`: Preset-based normalization
  - `preferPrefix`: Jaro-Winkler prefix boost
  - Legacy `normalize` boolean still supported

### Dependencies

- Added `@3leaps/string-metrics-wasm` v0.3.8 (WASM-backed algorithms)
- Upgraded normalization to support locale-aware casefolding

### Fixed

- Turkish dotted İ now correctly normalized to lowercase i with `locale: "tr"`
- Build artifacts test prevents accidental WASM bundling (tsup externalization verified)

### Documentation

- Updated `src/foundry/similarity/README.md` with v2 API documentation
- Migration guide for v1 to v2 upgrade
- Performance benchmarks and Unicode support details
- Turkish locale support memo in `.plans/memos/`

### Added

- **Pathfinder Module**: Enterprise filesystem traversal with observability and checksums
  - **Core Traversal**: Recursive directory scanning with glob pattern matching
    - `includePatterns` and `excludePatterns` for flexible file selection
    - `maxDepth` control for traversal depth limiting
    - `followSymlinks` and `includeHidden` for advanced filesystem access
    - Streaming results via `findIterable()` for memory-efficient large directory processing
  - **Ignore File Support**: `.fulmenignore` and `.gitignore` with nested precedence
    - Hierarchical ignore pattern loading from directory tree
    - Child directory patterns override parent directory rules
    - Configurable via `honorIgnoreFiles: boolean`
  - **FulHash Integration**: Optional streaming checksum calculation
    - Algorithms: `xxh3-128` (default) and `sha256` support
    - Streaming implementation prevents memory exhaustion on large files
    - Checksum errors handled gracefully with error metadata preservation
    - `<10% performance overhead` verified via benchmarks
  - **Path Constraints**: Security-focused path validation with enforcement levels
    - `EnforcementLevel.STRICT`: Reject violations with FulmenError
    - `EnforcementLevel.WARN`: Log warnings and continue operation
    - `EnforcementLevel.PERMISSIVE`: No enforcement (default)
    - Path traversal attack prevention with root boundary enforcement
    - `allowedPrefixes` and `forbiddenPatterns` for fine-grained control
  - **Enterprise Observability**: Full integration with TSFulmen infrastructure
    - Structured `FulmenError` with correlation IDs and severity levels
    - Telemetry metrics: `pathfinder_find_ms`, `pathfinder_security_warnings`
    - Progressive logging integration with policy-driven profiles
    - Schema validation via existing TSFulmen schema module
  - **Convenience Helpers**: Pre-configured finders for common use cases
    - `findConfigFiles()`: Discover YAML/JSON configuration files
    - `findSchemaFiles()`: Find `.schema.json` and `.schema.yaml` files
    - `findByExtensions()`: Generic extension-based file discovery
  - **Cross-Platform Support**: Linux, macOS, Windows compatibility
    - Path normalization and separator handling
    - Symlink resolution consistent across platforms
    - Windows-specific path length and character constraints
  - **Comprehensive Testing**: 44 tests with 111 assertions
    - Unit tests for all core functionality
    - Integration tests with real filesystem operations
    - Cross-platform fixture validation
    - Performance benchmark verification

---

## [0.1.2] - 2025-10-25

**Error Handling, Telemetry, and Core Utilities** - Comprehensive error handling with FulmenError, telemetry instrumentation across modules, FulHash for integrity verification, Similarity utilities, DocScribe for document processing, Progressive Logging, and complete Crucible Shim.

### Added

- **Error Handling Module**: Schema-backed error handling with FulmenError
  - `FulmenError` class with immutable data structure and schema validation
  - Static constructors: `fromError()`, `wrap()`, `fromData()`
  - Schema-compliant JSON serialization via `toJSON()`
  - Correlation ID support for distributed tracing
  - Severity levels with numeric mapping (critical: 1000, high: 750, medium: 500, low: 250, info: 100)
  - Exit code guidance for CLI applications
  - Context preservation from wrapped errors
  - Type guards: `isFulmenError()`, `isFulmenErrorData()`
  - Validator integration for schema compliance checking
  - 43 tests covering construction, wrapping, serialization, and validation

- **Telemetry Module**: Metrics collection and aggregation with OTLP export support
  - **Counter**: Monotonically increasing values (`inc()`)
  - **Gauge**: Arbitrary point-in-time values (`set()`, `inc()`, `dec()`)
  - **Histogram**: Distribution tracking with automatic bucketing
    - ADR-0007 compliant buckets for `_ms` metrics: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000]
    - Percentile calculations (p50, p95, p99)
    - Count, sum, min, max aggregations
  - **Global Registry**: Singleton registry accessible via `metrics.counter()`, `metrics.gauge()`, `metrics.histogram()`
  - **Export Formats**: OTLP-compatible JSON with RFC3339 timestamps
  - **Taxonomy Integration**: Loads metric definitions from `config/crucible-ts/taxonomy/metrics.yaml`
  - **Lifecycle Management**: `export()`, `flush()`, `clear()` for metric lifecycle
  - **Type Safety**: Full TypeScript types for all metric operations
  - 85 tests covering counters, gauges, histograms, registry, and taxonomy

- **Telemetry Instrumentation**: Observability across config, schema, and crucible modules
  - **Config Module Metrics**:
    - `config_load_ms` histogram - Directory/file operation timing
    - `config_load_errors` counter - Failed operations
    - Instrumented: `ensureDirExists()`, `resolveConfigPath()`
    - 7 telemetry integration tests
  - **Schema Module Metrics**:
    - `schema_validations` counter - Successful validations
    - `schema_validation_errors` counter - Failed validations
    - Instrumented: `validateData()`, `compileSchemaById()`, `validateDataBySchemaId()`, `validateFileBySchemaId()`
    - 9 telemetry integration tests
  - **Crucible Module Metrics**:
    - `foundry_lookup_count` counter - Successful asset loads
    - Instrumented: `loadSchemaById()`, `getDocumentation()`, `getConfigDefaults()`
    - 8 telemetry integration tests
  - **Zero Breaking Changes**: All error types unchanged, telemetry is transparent observation layer
  - **Taxonomy Compliance**: All metrics defined in Crucible taxonomy
  - 24 total telemetry tests, all existing tests pass

- **FulHash Module**: Fast, cross-language compatible hashing for integrity verification and checksums
  - **Block Hashing API**: One-shot hashing for in-memory data
    - `hash()` - Hash strings or byte arrays with configurable algorithm
    - `hashString()` - Convenience wrapper for string inputs
    - `hashBytes()` - Convenience wrapper for Uint8Array inputs
    - Async API supporting both SHA-256 and XXH3-128
    - Default algorithm: XXH3-128 (7.5 GB/s throughput, non-cryptographic)
    - SHA-256 option for cryptographic integrity (2.4 GB/s throughput)
  - **Streaming API**: Incremental hashing for large files without memory pressure
    - `createStreamHasher()` - Factory for streaming hash operations
    - `update()` - Chainable method for incremental data feeding
    - `digest()` - Finalize and return hash digest
    - `reset()` - Reuse hasher for multiple operations
    - State management preventing incorrect usage patterns
    - Concurrency-safe with factory pattern (each hasher owns WASM instance)
  - **Digest Operations**: Parse, verify, and compare hash checksums
    - `Digest.parse()` - Parse formatted checksums (`algorithm:hex`)
    - `Digest.verify()` - Verify data against checksum
    - `digest.equals()` - Compare digests for equality
    - `digest.formatted` - Standard `algorithm:hex` format
    - Immutable digest objects with defensive copying
  - **Cross-Language Compatibility**: Matches gofulmen/pyfulmen implementations
    - Standard checksum format: `algorithm:lowercase-hex`
    - Shared fixture validation (12 fixtures: 6 hash, 4 format, 2 error)
    - Consistent error naming across ecosystem
  - **High Performance**: Exceeds standard targets by 7-24x
    - XXH3-128: 7.5 GB/s on 100MB (target: 1 GB/s)
    - SHA-256: 2.4 GB/s on 100MB (target: 100 MB/s)
    - Streaming overhead: -33% (faster than block hashing!)
    - Small string hashing: <0.5ms per operation (10K ops)
    - Concurrent hashing: 1 GB/s aggregate throughput (100 ops)
  - **Concurrency Safety**: Factory pattern prevents race conditions
    - Each hash operation gets fresh WASM instance
    - No shared state between concurrent operations
    - Deterministic results under high concurrency
    - Stream hashers maintain independent state
  - **Error Handling**: Clear, actionable error messages
    - `UnsupportedAlgorithmError` - Lists supported algorithms
    - `InvalidChecksumFormatError` - Describes expected format
    - `InvalidChecksumError` - Explains validation failure
    - `DigestStateError` - Prevents incorrect hasher reuse
    - All errors extend `FulHashError` base class
  - **Package Exports**: Added `@fulmenhq/tsfulmen/fulhash` subpath
  - **Comprehensive Testing**: 157 tests across 11 test suites
    - Block hashing: 21 tests (SHA-256, XXH3-128, fixtures)
    - Streaming API: 20 tests (state management, reset, chaining)
    - Digest operations: 30 tests (parse, verify, compare, format)
    - Concurrency safety: 17 tests (race conditions, isolation)
    - Integration examples: 17 tests (real-world usage patterns)
    - Performance benchmarks: 10 tests (throughput, overhead)
    - Fixture validation: 12 tests (cross-language parity)
    - Error handling: 15 tests (all error conditions)
    - Type contracts: 15 tests (TypeScript interface validation)
  - **Documentation**: Complete API reference in `src/fulhash/README.md`
    - Quick start examples
    - Block and streaming usage patterns
    - Checksum validation workflows
    - Performance characteristics
    - Security considerations (crypto vs non-crypto)
    - Error handling guide
    - Cross-language compatibility notes
  - **Type Safety**: Full TypeScript strict mode with exported types
    - `Algorithm` enum (SHA256, XXH3_128)
    - `Digest` interface (immutable hash result)
    - `HashOptions` interface (algorithm, encoding)
    - `StreamHasher` interface (update, digest, reset)
    - `StreamHasherOptions` interface (algorithm configuration)

- **Foundry Similarity Module**: Text similarity and normalization utilities implementing Crucible 2025.10.2 standard
  - **Levenshtein Distance**: Wagner-Fischer algorithm with O(min(m,n)) space complexity
    - `distance()` - Calculate edit distance between strings
    - Grapheme cluster support via spread operator
    - Handles Unicode, emoji, combining marks correctly
  - **Similarity Scoring**: Normalized 0.0-1.0 similarity scores
    - `score()` - Calculate normalized similarity (1 - distance/maxLen)
    - Empty string handling (returns 1.0 for identical empty strings)
  - **Unicode Normalization**: Text normalization with configurable options
    - `normalize()` - Trim, case folding, optional accent stripping
    - `casefold()` - Unicode-aware lowercase with locale support
    - `stripAccents()` - NFD decomposition + combining mark removal
    - `equalsIgnoreCase()` - Normalized string comparison
    - Turkish locale support (dotted/dotless i handling)
  - **Suggestion API**: Ranked suggestions with configurable thresholds
    - `suggest()` - Get ranked suggestions with score filtering
    - Configurable minScore (default: 0.6), maxSuggestions (default: 3)
    - Optional normalization (default: true)
    - Score-based sorting with alphabetical tie-breaking
  - **High Performance**: <0.1ms p95 latency for 128-character strings (11x faster than <1ms target)
  - **Package Exports**: Added `@fulmenhq/tsfulmen/foundry` and `@fulmenhq/tsfulmen/foundry/similarity` subpaths
  - **Comprehensive Testing**: 127 tests with fixture-driven validation
  - **Type Safety**: Full TypeScript strict mode with exported types (Suggestion, SuggestOptions, NormalizeOptions)
  - **Documentation**: Complete API reference in `src/foundry/similarity/README.md`

- **Progressive Logging Module**: Policy-based logging with profile support (Phase 2 complete)
  - **Logging Profiles**: Simple, Standard, Detailed, Audit with automatic policy enforcement
  - **Policy Engine**: Enforces allowed fields, metadata, and severity levels per profile
  - **Pino Integration**: High-performance structured logging with 9.5.0
  - **Middleware System**: Transform events before emission
  - **Type Safety**: Full TypeScript types with discriminated unions
  - **Package Exports**: Added `@fulmenhq/tsfulmen/logging` subpath
  - **Comprehensive Testing**: 83 tests across 6 test suites
  - **Documentation**: Complete API reference in `src/logging/README.md`

- **Crucible Shim Module**: Complete implementation (Phases 1-4)
  - **Asset Discovery**: Fast discovery across schemas, docs, config with glob-based filtering
  - **Schema Access**: `listSchemas()`, `loadSchemaById()` with kind filtering (api, config, meta, etc.)
  - **Documentation Access**: `listDocumentation()`, `getDocumentation()` with metadata extraction
  - **Config Defaults**: `listConfigDefaults()`, `getConfigDefaults()` with version matching
  - **Version Parsing**: Intelligent version extraction from asset IDs
  - **Normalization**: Asset ID to path conversion with category awareness
  - **Error Handling**: AssetNotFoundError with similarity-based suggestions (3 suggestions, 60% threshold)
  - **Performance**: <250ms full discovery, <5ms individual category discovery
  - **Type Safety**: Full TypeScript types for all asset categories
  - **Comprehensive Testing**: 96 tests including integration and performance benchmarks

- **DocScribe Module**: Complete document processing pipeline
  - **Format Detection**: Identifies markdown, YAML, JSON, TOML, YAML-stream, and plain text
    - Magic number detection (JSON: `{`/`[`, YAML: `---`)
    - Heuristic analysis for ambiguous formats
    - Frontmatter-aware (distinguishes markdown with YAML from pure YAML)
    - YAML stream detection (multiple `---` separators)
  - **Frontmatter Processing**: YAML frontmatter parsing with schema awareness
    - `parseFrontmatter()` - Extract metadata and body with line tracking
    - `stripFrontmatter()` - Remove frontmatter, return body only
    - `extractMetadata()` - Metadata extraction only
    - Schema-aware normalization (title, author, date, tags, version, etc.)
    - Error handling with line/column position information
    - Handles empty frontmatter gracefully
  - **Header Extraction**: Markdown header parsing with slug generation
    - `extractHeaders()` - Extract all headers with level, text, slug, line number
    - ATX-style headers (`# Header`) with configurable depth limit
    - Customizable slugification function
    - Line number tracking for each header
  - **Document Splitting**: Multi-document splitting for YAML streams and markdown
    - `splitDocuments()` - Split content into individual documents
    - YAML stream support (multiple `---` separators)
    - Markdown splitting with heuristic detection
    - Fence-aware (respects code blocks: ```/~~~)
    - Configurable document limit with automatic merging
    - Line range tracking for each split
  - **Document Inspection**: Comprehensive document analysis
    - `inspectDocument()` - Full document metadata, format, headers, sections
    - Returns format, frontmatter status, metadata, header count, line count, size
    - Estimated section count based on headers
  - **Polymorphic Input**: Accepts `string | Uint8Array | ArrayBufferLike`
    - UTF-8 decoding with TextDecoder
    - Consistent normalization via `normalizeInput()`
  - **Type Safety**: Readonly types, discriminated unions, comprehensive error hierarchy
  - **Test Coverage**: 4 test suites with fixtures (frontmatter, format, headers, split)

- **Updated SSOT Dependencies**: Synced artifacts from Crucible
  - New schemas: `error-handling/v1.0.0/error-response.schema.json`
  - New schemas: `observability/metrics/v1.0.0/metrics-event.schema.json`
  - New standards: `library/modules/docscribe.md`, `library/modules/error-handling-propagation.md`, `library/modules/telemetry-metrics.md`
  - Updated standards: `devsecops/pre-commit-processes.md`, observability/logging enhancements
  - Updated ecosystem docs: Fulmen Forge Workhorse Standard, ecosystem guide

### Changed

- Version bump to 0.1.2
- Updated `docs/tsfulmen_overview.md` with all module statuses
- Updated `package.json` with error, telemetry, fulhash, logging, and docscribe export paths
- Updated README.md with comprehensive usage examples for new modules
- Enhanced test coverage to 981/991 tests passing (98.4% pass rate)

### Fixed

- Linting issues in format.ts and foundry modules
- Performance test thresholds adjusted to realistic values
- YAML detection and stream splitting improvements in docscribe and foundry
- Crucible schemas discovery performance threshold adjustment

---

## [0.1.1] - 2025-10-20

**Enterprise Module Implementation** - Implements Config Path API, Schema Validation, and complete Foundry module with pattern catalogs, HTTP status helpers, MIME type detection, and country codes.

### Added

- **Config Path API**: XDG-compliant configuration directory resolution
  - `getAppConfigDir()`, `getAppDataDir()`, `getAppCacheDir()` for application directories
  - `getFulmenConfigDir()`, `getFulmenDataDir()`, `getFulmenCacheDir()` for ecosystem directories
  - Platform-aware path resolution (Linux/XDG, macOS, Windows)
  - Security validation for absolute paths and traversal protection
  - Comprehensive cross-platform test coverage

- **Schema Validation Module**: JSON Schema 2020-12 validation with AJV
  - `validateDataBySchemaId()` for validating data against Crucible schemas
  - `validateFileBySchemaId()` for validating JSON/YAML files
  - `getGlobalRegistry()` for accessing schema registry
  - `compileSchemaById()` for pre-compiling schemas
  - `normalizeSchema()` for schema comparison and validation
  - Optional goneat bridge for cross-tool validation parity
  - Schema validation CLI (`bunx tsfulmen-schema`) for development
  - Draft 2020-12 support with meta-schema loading from Crucible
  - 45+ tests covering validation, registry, and goneat bridge

- **Foundry Module**: Complete pattern catalog implementation
  - **Pattern Catalog**: 21 regex/glob patterns with language-specific flags
    - `getPattern()`, `getPatternRegex()`, `matchPattern()` for pattern access
    - `listPatterns()`, `describePattern()` for catalog exploration
    - Deep immutability with frozen objects and defensive copying
    - Lazy regex compilation with caching
    - Glob pattern support via picomatch
  - **HTTP Status Catalog**: 58 HTTP status codes across 5 groups
    - `getHttpStatus()` for status lookup
    - `isInformational()`, `isSuccess()`, `isRedirection()`, `isClientError()`, `isServerError()` helpers
    - `getStatusReason()` for reason phrase lookup
    - `listHttpStatuses()` for catalog exploration
  - **MIME Type Catalog**: Content-based detection with magic numbers
    - Magic number pattern database for JSON, XML, YAML (exact byte matching)
    - Heuristic detection for NDJSON, CSV, Protocol Buffers, plain text
    - Priority-based detection engine with UTF-8 BOM handling
    - Streaming support for Buffer, ReadableStream, Node.js Readable, and file paths
    - `detectMimeType()` polymorphic function for all input types
    - `detectMimeTypeFromBuffer()` for direct buffer analysis
    - `detectMimeTypeFromFile()` with Bun.file() optimization and Node.js fallback
    - `detectMimeTypeFromStream()` for Web and Node.js streams
    - `matchMagicNumber()` utility for pattern verification
    - `getMimeTypeByExtension()` for fast extension-based lookup
    - DetectionOptions interface for configurable byte reading and fallback
    - 60+ tests for magic number detection across all formats
    - Test fixtures for integration testing
  - **Country Code Catalog**: ISO 3166 country codes with normalization
    - `getCountryByAlpha2()`, `getCountryByAlpha3()`, `getCountryByNumeric()` lookups
    - Case-insensitive alpha code matching (US, us, Us all work)
    - Numeric code normalization with left-padding (76 → "076")
    - `listCountries()` for catalog exploration
    - Precomputed indexes for O(1) lookups
    - 5 countries in MVP (US, CA, JP, DE, BR)

- **Foundry Infrastructure**:
  - YAML catalog loading with schema validation via AJV
  - Fail-fast error handling with descriptive FoundryCatalogError
  - Bun-first file loading with Node.js fallback
  - `loadAllCatalogs()` for parallel catalog initialization
  - Comprehensive test coverage (193 tests across all catalogs)
  - Zero runtime dependencies (uses yaml, ajv, picomatch)

### Changed

- Updated README with comprehensive usage examples for all modules
- Enhanced test coverage from 30%+ to 70%+ (292 total tests)
- Improved documentation with API examples and detection strategies

### Fixed

- Foundry loader test regression with readonly Bun global property
- Import ordering and linting issues across all new modules

---

## [0.1.0] - 2025-10-15

**Bootstrap Scaffold Release** - Establishes project foundation, governance, and tooling infrastructure. No working module implementations yet.

**Release Strategy**: TSFulmen follows a progressive upscaling approach:

- **v0.1.0**: Bootstrap scaffold (this release)
- **v0.1.1 - v0.1.x**: Progressive module implementations (Config Path API, Crucible Shim, Logging, Schema Validation)
- **v0.2.0**: First public release with complete Fulmen Helper Library Standard compliance

**Not Production Ready**: This release is for maintainer coordination and ecosystem alignment only. First usable release will be v0.2.0.

### Added

- **Project Foundation**: Initial repository structure and governance
  - TypeScript library scaffold with src/ layout
  - Bun-based dependency management and build tooling
  - tsup bundler configuration for ESM/CJS dual exports
  - Vitest testing framework with coverage support
  - Biome for linting and formatting

- **Repository Governance**: Complete project governance framework
  - AGENTS.md with Module Weaver identity (@module-weaver)
  - MAINTAINERS.md with human maintainer roster
  - REPOSITORY_SAFETY_PROTOCOLS.md for operational safety
  - CONTRIBUTING.md with development guidelines
  - MIT LICENSE

- **Makefile Standard**: FulmenHQ-compliant Makefile with all required standard targets
  - Core targets: `bootstrap`, `tools`, `sync-ssot`, `test`, `build`, `build-all`, `clean`
  - Quality targets: `lint` (Biome + goneat assess), `fmt` (Biome + goneat format), `typecheck` (tsc)
  - Version targets: `version`, `version-set`, `version-bump-{major,minor,patch,calver}`
  - Release targets: `release-check`, `release-prepare`, `release-build`
  - Hook targets: `precommit`, `prepush`
  - ADR targets: `adr-validate`, `adr-new`
  - Additional: `test-watch`, `test-coverage`, `bootstrap-force`
  - **Split linting approach**: Biome for TS/JS source, goneat for JSON/YAML/Markdown (matches pyfulmen/gofulmen pattern)

- **SSOT Integration**: Crucible asset synchronization via goneat
  - .goneat/ssot-consumer.yaml configuration
  - docs/crucible-ts/ for synced documentation
  - schemas/crucible-ts/ for synced JSON schemas
  - config/crucible-ts/ for synced config defaults
  - .crucible/metadata/ for sync metadata

- **Documentation**: Comprehensive project documentation
  - README.md with quick start and architecture overview
  - docs/tsfulmen_overview.md with module catalog and roadmap
  - docs/development/ with operations, bootstrap, and ADR documentation
  - docs/development/adr/ for Architecture Decision Records
    - Local ADR index and guidelines
    - Ecosystem ADR adoption tracking
    - ADR validation and creation tooling via Makefile
    - **ADR-0001**: Split linting approach (Biome for TS/JS, goneat for config/docs)
  - VSCode workspace configuration for development
  - Cross-references to ecosystem standards

- **Package Configuration**: Modern TypeScript package setup
  - package.json with proper exports and scripts
  - tsconfig.json with strict TypeScript configuration
  - ESM/CJS dual module support
  - Type definitions for all exports

- **Development Tools**: Quality assurance tooling
  - Biome configuration (biome.json)
  - Vitest configuration (vitest.config.ts)
  - Git hooks preparation
  - EditorConfig for consistent formatting

- **Version Management**: Initial versioning infrastructure
  - VERSION file (0.1.0)
  - LIFECYCLE_PHASE file (alpha)
  - Semantic versioning support via Makefile

### Changed

- **Agent Documentation**: Enhanced AGENTS.md with improvements from sibling repos
  - Added DO NOT Rules section with TypeScript-specific guidelines
  - Enhanced agent identity section with Mission, Capabilities, Communication Channels
  - Improved commit attribution examples
  - Added Safety Protocols and Development Philosophy sections
  - Added Getting Started section for agent interaction

### Fixed

- Repository structure aligned with Fulmen Helper Library Standard
- Cross-language consistency with gofulmen and pyfulmen governance

---

_Note: This changelog tracks the progressive upscaling of TSFulmen through v0.1.x releases._
