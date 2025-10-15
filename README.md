# TSFulmen

TypeScript Fulmen Helper Library - ergonomic access to Crucible SSOT assets and core utilities for TypeScript/Node.js applications in the FulmenHQ ecosystem.

> **📖 [Read the TSFulmen Overview](docs/tsfulmen_overview.md)** for architecture details, module catalog, and roadmap.

## Status

**Lifecycle Phase:** `alpha` (see [`LIFECYCLE_PHASE`](LIFECYCLE_PHASE))
**Development Status:** 🚧 Bootstrap complete, enterprise upscaling in progress
**Test Coverage:** 30%+ (alpha phase requirement)

TSFulmen is in active development with enterprise-grade modules being implemented. APIs may change as we align with gofulmen and pyfulmen. See [TSFulmen Overview](docs/tsfulmen_overview.md) for roadmap.

## Features (Planned)

- **Config Path API** - XDG-compliant configuration directory resolution
- **Crucible Shim** - Typed access to synced schemas, docs, and config defaults
- **Logging** - Pino wrapper implementing observability standards
- **Schema Validation** - JSON schema validation utilities using AJV
- **Error Handling** - Base FulmenError class and error patterns
- **Three-Layer Config Loading** - Defaults → User → BYOC

## Installation

```bash
bun add @fulmenhq/tsfulmen
# or
npm install @fulmenhq/tsfulmen
```

## Development Setup

### Prerequisites

- Bun >= 1.0.0
- Git
- Access to sibling `crucible` repository (for SSOT sync)

### Quick Start

```bash
# Clone repository
git clone https://github.com/fulmenhq/tsfulmen.git
cd tsfulmen

# Bootstrap (install deps + tools)
make bootstrap

# Sync assets from Crucible
make sync-ssot

# Run tests
make test

# Build library
make build
```

## Makefile Targets

TSFulmen follows the [FulmenHQ Makefile Standard](https://github.com/fulmenhq/crucible/blob/main/docs/standards/makefile-standard.md). All CI/CD operations use `make` targets, not `package.json` scripts.

### Required Targets

- `make help` - Show all available targets
- `make bootstrap` - Install dependencies and external tools
- `make sync-ssot` - Sync assets from Crucible SSOT
- `make tools` - Verify external tools are installed
- `make test` - Run test suite
- `make build` - Build distributable artifacts
- `make lint` - Run linting checks
- `make fmt` - Apply code formatting
- `make typecheck` - Run TypeScript type checking
- `make check-all` - Run all quality checks (lint + typecheck + test)
- `make clean` - Remove build artifacts

### Version Management

- `make version` - Print current version
- `make version-bump-patch` - Bump patch version
- `make version-bump-minor` - Bump minor version
- `make version-bump-major` - Bump major version
- `make version-bump-calver` - Bump to CalVer

## Architecture

TSFulmen implements the [Fulmen Helper Library Standard](https://github.com/fulmenhq/crucible/blob/main/docs/architecture/fulmen-helper-library-standard.md) and mirrors capabilities from [gofulmen](https://github.com/fulmenhq/gofulmen).

**See [TSFulmen Overview](docs/tsfulmen_overview.md) for complete architecture documentation, module catalog, and dependency map.**

### Module Structure

```
src/
├── config/      # Config path API and loader
├── crucible/    # Crucible SSOT shim
├── errors/      # Error base classes
├── logging/     # Logging wrapper (pino)
└── schema/      # Schema validation
```

### SSOT Sync Model

Assets from Crucible are synced via goneat and committed to version control:

```
docs/crucible-ts/     # Synced documentation
schemas/crucible-ts/  # Synced JSON schemas
config/crucible-ts/   # Synced config defaults
.crucible/metadata/   # Sync metadata
```

Sync configuration: [`.goneat/ssot-consumer.yaml`](.goneat/ssot-consumer.yaml)

See [Sync Model Architecture](https://github.com/fulmenhq/crucible/blob/main/docs/architecture/sync-model.md) for details.

## Usage

```typescript
import { VERSION } from "@fulmenhq/tsfulmen";
// import { getAppConfigDir } from '@fulmenhq/tsfulmen/config';
// import { createLogger } from '@fulmenhq/tsfulmen/logging';

console.log(`TSFulmen ${VERSION}`);

// Future examples:
// const configDir = getAppConfigDir('myapp');
// const logger = createLogger({ level: 'info' });
```

## Testing

```bash
make test              # Run all tests
make test-watch        # Watch mode
make test-coverage     # With coverage report
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT - See [LICENSE](LICENSE) for details.

## Related Projects

- [crucible](https://github.com/fulmenhq/crucible) - SSOT for schemas, standards, and templates
- [gofulmen](https://github.com/fulmenhq/gofulmen) - Go helper library (reference implementation)
- [pyfulmen](https://github.com/fulmenhq/pyfulmen) - Python helper library
- [goneat](https://github.com/fulmenhq/goneat) - Schema validation and automation CLI

---

**Status:** Bootstrap Complete - Enterprise Upscaling in Progress
**Version:** 0.1.0-dev
**Last Updated:** 2025-10-11
