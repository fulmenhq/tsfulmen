# Release Notes

This document tracks release notes and checklists for TSFulmen releases.

## [0.1.0] - 2025-10-15

### Foundation Release - Project Structure & Governance

**Release Type**: Foundation Bootstrap
**Release Date**: October 15, 2025
**Status**: ✅ Ready for Release

#### Features

**Project Foundation**:

- ✅ **Repository Structure**: TypeScript library scaffold with src/ layout
- ✅ **Dependency Management**: Bun-based tooling and package management
- ✅ **Build System**: tsup bundler with ESM/CJS dual exports
- ✅ **Testing Framework**: Vitest with coverage support
- ✅ **Quality Tooling**: Biome for linting and formatting
- ✅ **Type Safety**: TypeScript strict mode configuration

**Governance & Documentation**:

- ✅ **Agent Framework**: Module Weaver identity (@module-weaver) with enhanced AGENTS.md
- ✅ **Repository Governance**: MAINTAINERS.md, REPOSITORY_SAFETY_PROTOCOLS.md, CONTRIBUTING.md
- ✅ **Project Documentation**: README.md, docs/tsfulmen_overview.md with module catalog
- ✅ **MIT License**: Open source licensing

**Makefile Standard**:

- ✅ **FulmenHQ-Compliant Targets**: bootstrap, sync-ssot, test, build, lint, fmt, typecheck, check-all
- ✅ **Version Management**: version, version-bump-patch/minor/major targets
- ✅ **Quality Gates**: Integrated check-all target for comprehensive validation

**SSOT Integration**:

- ✅ **Goneat Configuration**: .goneat/ssot-consumer.yaml for asset synchronization
- ✅ **Synced Assets**: docs/crucible-ts/, schemas/crucible-ts/, config/crucible-ts/
- ✅ **Metadata Tracking**: .crucible/metadata/ for sync state

**Development Experience**:

- ✅ **VSCode Configuration**: Workspace settings for out-of-box development
- ✅ **EditorConfig**: Consistent formatting across editors
- ✅ **Package Exports**: Proper module exports for ESM/CJS consumers
- ✅ **Type Definitions**: Full TypeScript type support

#### Breaking Changes

- None (initial release)

#### Migration Notes

- This is the foundation release establishing repository structure and governance
- No code migrations required as this is the initial release
- Future v0.1.x releases will add core modules while maintaining API compatibility

#### Known Limitations

- **Core Modules Not Yet Implemented**: All 7 core modules planned for v0.1.1+
  - config-path-api (XDG-compliant config directories)
  - crucible-shim (Typed Crucible SSOT access)
  - schema-validation (AJV-based validation)
  - three-layer-config (Defaults → User → Runtime)
  - foundry (Pattern catalogs, HTTP statuses, MIME types)
  - logging (Progressive profiles)
  - ssot-sync (Programmatic goneat wrapper)

- **Test Coverage**: Minimal (infrastructure only, no application code yet)
- **No Published Package**: Not yet published to npm (pre-release)

#### Quality Gates

- [x] Repository structure follows TypeScript best practices
- [x] Makefile compliant with FulmenHQ standard
- [x] SSOT sync configuration validated
- [x] Documentation complete for foundation release
- [x] Governance files in place (AGENTS.md, MAINTAINERS.md, REPOSITORY_SAFETY_PROTOCOLS.md)
- [x] Agent identity established and documented
- [x] Safety protocols documented with proper attribution standards
- [x] Cross-language coordination patterns established
- [x] Version management infrastructure in place
- [x] CHANGELOG.md and RELEASE_NOTES.md created

#### Release Checklist

- [x] Version number set in VERSION (0.1.0)
- [x] LIFECYCLE_PHASE set (alpha)
- [x] CHANGELOG.md created with v0.1.0 release notes
- [x] RELEASE_NOTES.md created
- [x] docs/releases/v0.1.0.md to be created
- [x] AGENTS.md enhanced with sibling repo improvements
- [x] All governance files in place
- [x] Repository structure validated
- [x] Makefile targets tested
- [x] SSOT sync configuration validated
- [ ] Git tag created (v0.1.0) - pending
- [ ] Tag pushed to GitHub - pending

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

#### Breaking Changes

- None (additive release maintaining v0.1.0 API)

#### Migration Notes

- No breaking changes from v0.1.0
- All new modules available via named imports:
  ```typescript
  import { getConfigPath, getDataPath } from "tsfulmen/config";
  import { validateYaml, SchemaRegistry } from "tsfulmen/schema";
  import { patterns, httpStatuses, detectMimeType } from "tsfulmen/foundry";
  ```

#### Known Limitations

- **Remaining Modules Not Yet Implemented** (planned for v0.1.2+):
  - crucible-shim (Typed Crucible SSOT access)
  - three-layer-config (Defaults → User → Runtime)
  - logging (Progressive profiles)
  - ssot-sync (Programmatic goneat wrapper)

- **Schema Validation**: Remote schema fetching not yet implemented
- **MIME Detection**: Limited to 7 common types (extensible architecture in place)
- **No Published Package**: Not yet published to npm (pre-release)

#### Quality Gates

- [x] All tests passing (292 tests)
- [x] Type checking clean (`make typecheck`)
- [x] Linting clean (`make lint`)
- [x] Build successful (`make build`)
- [x] CHANGELOG.md updated with v0.1.1 entries
- [x] README.md updated with module documentation
- [x] Cross-platform compatibility verified

#### Release Checklist

- [ ] Version number updated in VERSION (0.1.1)
- [ ] LIFECYCLE_PHASE verified (alpha)
- [ ] CHANGELOG.md finalized for v0.1.1
- [ ] RELEASE_NOTES.md updated (this file)
- [ ] README.md reflects v0.1.1 status
- [ ] docs/tsfulmen_overview.md module catalog updated
- [ ] Git tag created (v0.1.1) - pending approval
- [ ] Tag pushed to GitHub - pending approval

---

## [Unreleased]

### v0.1.2+ - Remaining Core Modules (Planned)

Implementation of remaining core modules per Fulmen Helper Library Standard:

- crucible-shim - Typed access to embedded Crucible assets
- three-layer-config - Layered configuration loading
- logging - Progressive logging with policy enforcement
- ssot-sync - Programmatic SSOT synchronization

Target: Maintain 80%+ test coverage, cross-language API parity with gofulmen/pyfulmen

### v0.2.0 - Enterprise Complete (Future)

- Full enterprise logging implementation
- Complete progressive interface features
- Cross-language compatibility verified
- Comprehensive documentation and examples
- Production-ready for FulmenHQ ecosystem

---

_Release notes will be updated as development progresses._
