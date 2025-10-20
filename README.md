# TSFulmen

TypeScript Fulmen Helper Library - ergonomic access to Crucible SSOT assets and core utilities for TypeScript/Node.js applications in the FulmenHQ ecosystem.

> **📖 [Read the TSFulmen Overview](docs/tsfulmen_overview.md)** for architecture details, module catalog, and roadmap.

## Status

**Lifecycle Phase:** `alpha` (see [`LIFECYCLE_PHASE`](LIFECYCLE_PHASE))
**Development Status:** 🚧 Bootstrap complete, enterprise upscaling in progress
**Test Coverage:** 30%+ (alpha phase requirement)

TSFulmen is in active development with enterprise-grade modules being implemented. APIs may change as we align with gofulmen and pyfulmen. See [TSFulmen Overview](docs/tsfulmen_overview.md) for roadmap.

## Features

- ✅ **Config Path API** - XDG-compliant configuration directory resolution
- ✅ **Schema Validation** - JSON Schema 2020-12 validation with AJV and optional CLI
- 🚧 **Crucible Shim** - Typed access to synced schemas, docs, and config defaults
- 🚧 **Logging** - Pino wrapper implementing observability standards
- 🚧 **Error Handling** - Base FulmenError class and error patterns
- 🚧 **Three-Layer Config Loading** - Defaults → User → BYOC

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

### Config Path API

```typescript
import { getAppConfigDir, getFulmenConfigDir } from "@fulmenhq/tsfulmen/config";

// Get XDG-compliant config directory for your app
const configDir = getAppConfigDir("myapp");
// ~/.config/myapp (Linux/macOS) or %APPDATA%\myapp (Windows)

// Get Fulmen ecosystem config directory
const fulmenDir = getFulmenConfigDir();
// ~/.config/fulmen
```

### Schema Validation

```typescript
import {
  getGlobalRegistry,
  compileSchemaById,
  validateDataBySchemaId,
  validateFileBySchemaId,
  normalizeSchema,
} from "@fulmenhq/tsfulmen/schema";

// List available schemas from Crucible SSOT
const registry = getGlobalRegistry();
const schemas = registry.listSchemas("config/");

// Validate data against a schema
const result = await validateDataBySchemaId(
  "config/sync-consumer-config",
  configData,
);
if (!result.valid) {
  console.error("Validation errors:", result.errors);
}

// Validate a file (JSON or YAML)
const fileResult = await validateFileBySchemaId(
  "config/sync-consumer-config",
  "./my-config.yaml",
);

// Normalize schema for comparison
const normalized = await normalizeSchema("./schema.yaml");
```

### Schema Validation CLI (Developer Tool)

TSFulmen includes a CLI for schema exploration and validation during development:

```bash
# List available schemas
bunx tsfulmen-schema list
bunx tsfulmen-schema list config/

# Show schema details
bunx tsfulmen-schema show --id config/sync-consumer-config

# Validate data against schema
bunx tsfulmen-schema validate --schema-id config/sync-consumer-config config.yaml

# Validate schema document itself
bunx tsfulmen-schema validate-schema ./my-schema.json

# Normalize schema for comparison
bunx tsfulmen-schema normalize schema.yaml

# Compare AJV vs goneat validation (requires goneat installed)
bunx tsfulmen-schema compare --schema-id config/sync-consumer-config config.yaml
```

**Note**: The CLI is a developer aid for exploring schemas and debugging validation. Production applications should use the library API directly.

### MIME Type Detection

TSFulmen provides content-based MIME type detection using magic numbers and heuristic analysis:

```typescript
import {
  detectMimeType,
  detectMimeTypeFromFile,
  detectMimeTypeFromBuffer,
  getMimeTypeByExtension,
} from "@fulmenhq/tsfulmen/foundry";

// Detect from buffer (magic number detection)
const buffer = Buffer.from('{"key": "value"}');
const type = await detectMimeType(buffer);
console.log(type?.mime); // 'application/json'

// Detect from file path
const fileType = await detectMimeTypeFromFile("./data.yaml");
console.log(fileType?.mime); // 'application/yaml'

// Detect from stream
const stream = fs.createReadStream("./document.xml");
const streamType = await detectMimeType(stream);
console.log(streamType?.mime); // 'application/xml'

// Extension-based lookup (fast, no content analysis)
const csvType = await getMimeTypeByExtension(".csv");
console.log(csvType?.mime); // 'text/csv'
```

**Supported Formats**:

- **JSON**: Magic number detection (`{`, `[`)
- **YAML**: Magic number detection (`---`, `%YAML`)
- **XML**: Magic number detection (`<?xml`)
- **NDJSON**: Heuristic detection (newline-delimited JSON)
- **CSV**: Heuristic detection (consistent delimiters)
- **Protocol Buffers**: Heuristic detection (binary format)
- **Plain Text**: Heuristic detection (UTF-8/ASCII)

**Detection Options**:

```typescript
const type = await detectMimeType(buffer, {
  bytesToRead: 512, // Bytes to analyze (default: 512)
  fallbackToExtension: true, // Use extension hint if magic fails
  extensionHint: ".json", // Extension for fallback
});
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
**Last Updated:** 2025-10-20
