# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

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
