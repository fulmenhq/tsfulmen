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

## [Unreleased]

### v0.1.1+ - Core Module Implementation (Planned)

Implementation of the 7 core modules per Fulmen Helper Library Standard:

- config-path-api - XDG-compliant configuration directory resolution
- crucible-shim - Typed access to embedded Crucible assets
- schema-validation - JSON Schema validation with AJV
- three-layer-config - Layered configuration loading
- foundry - Pattern catalogs, HTTP status helpers, MIME detection
- logging - Progressive logging with policy enforcement
- ssot-sync - Programmatic SSOT synchronization

Target: 80%+ test coverage, cross-language API parity with gofulmen/pyfulmen

### v0.2.0 - Enterprise Complete (Future)

- Full enterprise logging implementation
- Complete progressive interface features
- Cross-language compatibility verified
- Comprehensive documentation and examples
- Production-ready for FulmenHQ ecosystem

---

_Release notes will be updated as development progresses._
