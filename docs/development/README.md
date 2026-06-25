# TSFulmen Development Documentation

This directory contains documentation for TSFulmen maintainers and contributors.

## 📁 Documentation Index

### [Bootstrap Guide](bootstrap.md)

Complete guide to bootstrapping TSFulmen development environment, including:

- Tool installation (goneat, Bun, TypeScript)
- Dependency management
- SSOT sync setup
- Initial development workflow

### [Operations Guide](operations.md)

Development operations documentation covering:

- Development workflow and daily commands
- Testing strategy and quality gates
- Release process and version management
- Community guidelines and support channels
- Security and dependency management

### [Benchmarking Guide](benchmarking.md)

Guide to running and interpreting performance benchmarks for FulHash and other modules.

### [Compile-Safe SSOT Assets](compile-safe-assets.md)

How tsfulmen's SSOT assets resolve without the filesystem — the `AssetResolver`, `TSFULMEN_ASSET_MODE`, and building a `bun --compile` single-file binary that runs the full SDK (including standalone `serve`). For consumers shipping compiled binaries and for maintainers of the checked-in embedded asset modules (`make embed-assets` / `verify-embedded-assets`).

### [Architecture Decision Records (ADRs)](adr/README.md)

Documentation of architectural decisions for TSFulmen:

- **Local ADRs**: TypeScript-specific implementation decisions
- **Ecosystem ADRs**: Cross-language decisions synced from Crucible
- **Adoption Tracking**: Status of ecosystem ADR implementation

See [ADR Index](adr/README.md) for complete list and guidelines on when to write local ADRs vs. promoting to ecosystem level.

## 🎯 Quick Start for Contributors

```bash
# 1. Bootstrap development environment
make bootstrap

# 2. Sync Crucible assets
make sync-ssot

# 3. Run tests
make test

# 4. Start developing
make fmt lint typecheck test
```

## 📚 Additional Resources

- **[TSFulmen Overview](../tsfulmen_overview.md)**: Comprehensive library overview
- **[Crucible Standards](../crucible-ts/standards/)**: Coding standards and best practices
- **[Architecture Docs](../crucible-ts/architecture/)**: Fulmen ecosystem architecture
- **[Repository Safety Protocols](../../REPOSITORY_SAFETY_PROTOCOLS.md)**: Operational safety guidelines
- **[Maintainers](../../MAINTAINERS.md)**: Maintainer team and contact info

## 🤝 Contributing

See [operations.md](operations.md) for detailed contribution guidelines and development workflow.

---

_Part of the FulmenHQ ecosystem - standardized across all helper libraries_
