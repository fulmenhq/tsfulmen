# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

---

## [0.1.2] - 2025-10-22

**DocScribe Module** - Source-agnostic document processing with frontmatter parsing, format detection, header extraction, and multi-document splitting.

### Added

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
- Updated `docs/tsfulmen_overview.md` with DocScribe module status
- Updated `package.json` with docscribe export path

### Fixed

- Linting issue in `format.ts` (unused error variable)

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
