# TSFulmen

**Curated Libraries for Scale**

TypeScript Fulmen helper library for enterprise-scale development.

📖 **[Read the complete TSFulmen Overview](docs/tsfulmen_overview.md)** for comprehensive documentation including module catalog, dependency map, and roadmap.

## Status

**Lifecycle Phase:** `alpha` (see [`LIFECYCLE_PHASE`](LIFECYCLE_PHASE))
**Development Status:** ✅ v0.1.9 - Fulpack archives, pathfinder repository root discovery
**Test Coverage:** 1638 tests passing (100% pass rate)

TSFulmen v0.1.9 adds security-first archive operations (fulpack) for TAR/TAR.GZ/ZIP/GZIP formats and repository root discovery (pathfinder) with boundary enforcement. See [TSFulmen Overview](docs/tsfulmen_overview.md) for roadmap.

## Features

- ✅ **Error Handling** - Schema-backed FulmenError with severity levels (43 tests)
- ✅ **Telemetry & Metrics** - Counter/gauge/histogram with OTLP export (85 tests)
- ✅ **Telemetry Instrumentation** - Metrics in config, schema, crucible modules (24 tests)
- ✅ **FulHash** - Fast hashing with XXH3-128 and SHA-256, 22x faster small inputs (157 tests)
- ✅ **Fulpack** - Archive operations (TAR, TAR.GZ, ZIP, GZIP) with security-first design (20 tests)
- ✅ **Progressive Logging** - Policy enforcement with Pino profiles (83 tests)
- ✅ **Crucible Shim** - Typed access to synced schemas, docs, and config defaults (96 tests)
- ✅ **DocScribe** - Document processing with frontmatter parsing (50+ tests)
- ✅ **Config Path API** - XDG-compliant configuration directory resolution (26 tests)
- ✅ **Schema Validation** - JSON Schema 2020-12 validation with AJV and CLI (115 tests)
- ✅ **Foundry Module** - Pattern catalogs, HTTP statuses, MIME detection, similarity (278 tests)
- ✅ **Exit Codes** - Standardized process exit codes with simplified modes and platform detection (34 tests)
- ✅ **Signal Handling** - Cross-platform signal handling with graceful shutdown and Windows fallback (180 tests)
- ✅ **Application Identity** - .fulmen/app.yaml discovery with caching and validation (93 tests)
- ✅ **Pathfinder** - Filesystem traversal, repository root discovery with security boundaries, checksums, and observability (70 tests)
- 🚧 **Three-Layer Config Loading** - Defaults → User → BYOC (planned v0.2.x)

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
├── config/      # ✅ Config path API (XDG-compliant directories)
├── crucible/    # 🚧 Crucible SSOT shim
├── errors/      # ✅ Error handling & propagation
├── foundry/     # ✅ Pattern catalogs, HTTP statuses, MIME detection
├── fulhash/     # ✅ Fast hashing with XXH3-128 and SHA-256
├── fulpack/     # ✅ Archive operations (TAR, TAR.GZ, ZIP, GZIP)
├── logging/     # ✅ Progressive logging with policy enforcement
├── pathfinder/  # ✅ Filesystem traversal with checksums and observability
├── schema/      # ✅ Schema validation (AJV + CLI)
└── telemetry/   # ✅ Metrics collection & export
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

### Application Identity

Load application identity from `.fulmen/app.yaml` for vendor/app-specific configuration:

```typescript
import {
  loadIdentity,
  getBinaryName,
  buildEnvVar,
} from "@fulmenhq/tsfulmen/appidentity";

// Load identity (cached after first call)
const identity = await loadIdentity();

console.log(`Binary: ${identity.app.binary_name}`);
console.log(`Vendor: ${identity.app.vendor}`);

// Build environment variable names
const dbUrl = await buildEnvVar("database-url");
// Returns: 'MYAPP_DATABASE_URL' (hyphens normalized to underscores)

// Get env var value with prefix
const logLevel = await getEnvVar("log_level", { defaultValue: "info" });
```

**Discovery order**:

1. Explicit path: `loadIdentity({ path: '/path/to/app.yaml' })`
2. Environment variable: `FULMEN_APP_IDENTITY_PATH=/path/to/app.yaml`
3. Ancestor search: walks upward from CWD to find `.fulmen/app.yaml`

**CLI commands**:

```bash
# Show identity details
bunx tsfulmen-schema identity-show
bunx tsfulmen-schema identity-show --json
bunx tsfulmen-schema identity-show --path /custom/path/app.yaml

# Validate identity file
bunx tsfulmen-schema identity-validate
bunx tsfulmen-schema identity-validate fixtures/app.yaml

# Validate in CI
make validate-app-identity
```

See [App Identity Standard](docs/crucible-ts/standards/library/modules/app-identity.md) for schema details.

### Error Handling

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

// Wrap existing errors
try {
  await loadConfig();
} catch (err) {
  throw FulmenError.fromError(err, {
    code: "CONFIG_LOAD_FAILED",
    severity: "high",
    context: { file: "/path/to/config.json" },
  });
}

// Create structured errors
const error = new FulmenError({
  code: "VALIDATION_FAILED",
  message: "Schema validation failed",
  severity: "medium",
  correlation_id: "550e8400-e29b-41d4-a716-446655440000",
  context: { schema_id: "metrics-event", error_count: 3 },
});
```

### Telemetry & Metrics

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

// Counter: monotonic incrementing values
metrics.counter("schema_validations").inc();
metrics.counter("config_load_errors").inc(2);

// Gauge: arbitrary values
metrics.gauge("foundry_lookup_count").set(42);

// Histogram: distribution with automatic bucketing
const startTime = performance.now();
await performOperation();
metrics
  .histogram("operation_duration_ms")
  .observe(performance.now() - startTime);

// Export all metrics
const events = await metrics.export();

// Flush: export and clear
await metrics.flush({
  emit: (events) => logger.info({ metrics: events }),
});
```

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

# Export schema with provenance metadata
bunx tsfulmen-schema export \
  --schema-id library/foundry/v1.0.0/exit-codes \
  --out vendor/crucible/schemas/exit-codes.schema.json
```

**Note**: The CLI is a developer aid for exploring schemas and debugging validation. Production applications should use the library API directly.

### Schema Export

Export schemas from the Crucible registry with embedded provenance metadata for dual-hosting or downstream tooling.

```typescript
import { exportSchema } from "@fulmenhq/tsfulmen/schema";

await exportSchema({
  schemaId: "library/foundry/v1.0.0/exit-codes",
  outPath: "vendor/crucible/schemas/exit-codes.schema.json",
  includeProvenance: true, // default: true
  validate: true, // default: true
});
```

The export writes a deterministic schema file and stores provenance (Crucible version, git revision, export timestamp) under the `$comment["x-crucible-source"]` key. To compare exports against the runtime registry, call `stripProvenance()` before diffing:

```typescript
import { readFile } from "node:fs/promises";
import { stripProvenance } from "@fulmenhq/tsfulmen/schema";

const exported = await readFile(
  "vendor/crucible/schemas/exit-codes.schema.json",
  "utf-8",
);
const normalized = stripProvenance(exported);
```

The CLI exposes the same functionality for quick workflows:

```bash
bunx tsfulmen-schema export \
  --schema-id library/foundry/v1.0.0/exit-codes \
  --out vendor/crucible/schemas/exit-codes.schema.yaml \
  --format yaml \
  --no-provenance        # optional
  --force                # overwrite existing file
```

### Exit Codes

TSFulmen provides standardized process exit codes (54 codes across 11 categories) from the Crucible Foundry catalog:

```typescript
import { exitCodes, getExitCodeInfo } from "@fulmenhq/tsfulmen/foundry";

// Use specific exit codes for observable failures
async function main() {
  const config = await loadConfig();
  if (!config) {
    console.error("Configuration validation failed");
    process.exit(exitCodes.EXIT_CONFIG_INVALID); // 20
  }

  const server = await startServer(config.port);
  if (!server) {
    console.error("Port already in use");
    process.exit(exitCodes.EXIT_PORT_IN_USE); // 10
  }

  process.exit(exitCodes.EXIT_SUCCESS); // 0
}
```

**Simplified Modes** for basic CLI tools or Windows compatibility:

```typescript
import {
  exitCodes,
  mapExitCodeToSimplified,
  SimplifiedMode,
  supportsSignalExitCodes,
} from "@fulmenhq/tsfulmen/foundry";

let exitCode = exitCodes.EXIT_CONFIG_INVALID; // 20

// BASIC mode: collapse to 0 (success) or 1 (failure)
const basicCode = mapExitCodeToSimplified(exitCode, SimplifiedMode.BASIC);
// Returns: 1 (failure)

// SEVERITY mode: categorize by retry strategy
const severityCode = mapExitCodeToSimplified(exitCode, SimplifiedMode.SEVERITY);
// Returns: 2 (config error - fix before retry)

// Platform capability detection
if (!supportsSignalExitCodes()) {
  // On Windows: use simplified mode since signal codes (128+) don't apply
  exitCode = mapExitCodeToSimplified(exitCode, SimplifiedMode.BASIC);
}
```

**Exit Code Metadata** for observability and retry logic:

```typescript
import { getExitCodeInfo, exitCodes } from "@fulmenhq/tsfulmen/foundry";

const info = getExitCodeInfo(exitCodes.EXIT_DATABASE_UNAVAILABLE);
console.log(info.code); // 31
console.log(info.name); // "EXIT_DATABASE_UNAVAILABLE"
console.log(info.category); // "runtime"
console.log(info.retryHint); // "retry" (safe to retry)

// Use retry hint for automation
if (info.retryHint === "retry") {
  await retryWithBackoff();
} else if (info.retryHint === "no_retry") {
  logger.error("Permanent failure, manual intervention required");
}
```

**Categories**: standard (0-1), networking (10-19), configuration (20-29), runtime (30-39), usage (40-49), permissions (50-59), data (60-69), security (70-79), observability (80-89), testing (91-99), signals (128-165)

See [Exit Codes Application Guide](docs/crucible-ts/standards/fulmen/exit-codes/README.md) for complete documentation.

### Signals CLI (Developer Tool)

TSFulmen includes a CLI for signal catalog exploration and debugging:

```bash
# List all signals with platform support
bunx tsx src/foundry/signals/cli.ts show

# Show specific signal details
bunx tsx src/foundry/signals/cli.ts show SIGTERM
bunx tsx src/foundry/signals/cli.ts show HUP    # Name normalization supported

# Show behaviors
bunx tsx src/foundry/signals/cli.ts show --behaviors
bunx tsx src/foundry/signals/cli.ts show graceful_shutdown --behaviors

# Show platform capabilities
bunx tsx src/foundry/signals/cli.ts platform
bunx tsx src/foundry/signals/cli.ts platform --json

# Validate signal configuration file
bunx tsx src/foundry/signals/cli.ts validate config/signals.yaml
```

**Makefile Targets**:

```bash
# Validate signal catalog integrity
make validate-signals

# Verify signals parity with Crucible
make verify-signals-parity
```

**Note**: The CLI is a developer tool for exploring the signal catalog and debugging configurations. Production applications should use the library API directly (`@fulmenhq/tsfulmen/foundry/signals`).

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

### Fulpack - Archive Operations

Secure archive creation, extraction, and inspection with security-first design for TAR, TAR.GZ, ZIP, and GZIP formats.

**Features:**

- Five canonical operations: `create()`, `extract()`, `scan()`, `verify()`, `info()`
- Four archive formats: TAR (uncompressed), TAR.GZ (gzip), ZIP (deflate), GZIP (single file)
- Security-first design: path traversal protection, decompression bomb detection, symlink safety validation
- Checksum verification via fulhash integration (SHA-256, xxh3-128)
- Pathfinder integration: `scan()` backend for archive discovery
- Streaming architecture for memory-efficient operations

**Basic Usage:**

```typescript
import {
  create,
  extract,
  scan,
  verify,
  info,
  ArchiveFormat,
} from "@fulmenhq/tsfulmen/fulpack";

// Create TAR.GZ archive
const archiveInfo = await create(
  "./src", // Source directory
  "./dist/app.tar.gz", // Output archive
  ArchiveFormat.TAR_GZ, // Format
  { compression_level: 9 }, // Options
);

// Extract archive with security checks
const result = await extract(
  "./dist/app.tar.gz", // Archive path
  "./output", // Destination
  { overwrite: "skip" }, // Skip existing files
);

console.log(
  `Extracted ${result.extracted_count} files, skipped ${result.skipped_count}`,
);
```

**Scan Archives (Pathfinder Integration):**

```typescript
// Scan archive contents without extraction
const entries = await scan("./data.tar.gz");

// Filter entries using standard JavaScript
const csvFiles = entries.filter(
  (e) => e.type === "file" && e.path.endsWith(".csv"),
);
console.log(`Found ${csvFiles.length} CSV files`);

// Check for specific files
const hasConfig = entries.some((e) => e.path === "config/app.json");

// Get total uncompressed size
const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
```

**Security Validation:**

```typescript
// Verify archive integrity before extraction
const validation = await verify("./untrusted.tar.gz");

if (!validation.valid) {
  console.error("Archive validation failed:");
  validation.errors.forEach((err) =>
    console.error(`  - ${err.code}: ${err.message}`),
  );
  process.exit(1);
}

// Check security validations performed
console.log("Security checks:", validation.checks_performed.join(", "));
// Output: structure_valid, no_path_traversal, symlinks_safe, no_decompression_bomb
```

**Archive Metadata:**

```typescript
// Get quick metadata without extraction
const metadata = await info("./backup.tar.gz");

console.log(`Format: ${metadata.format}`);
console.log(`Entries: ${metadata.entry_count}`);
console.log(
  `Compressed: ${(metadata.compressed_size / 1024 / 1024).toFixed(2)} MB`,
);
console.log(
  `Uncompressed: ${(metadata.total_size / 1024 / 1024).toFixed(2)} MB`,
);
console.log(`Ratio: ${metadata.compression_ratio.toFixed(2)}:1`);
```

**Format Selection:**

```typescript
// TAR (uncompressed) - Fastest for pre-compressed data
await create("./images", "./backup.tar", ArchiveFormat.TAR);

// TAR.GZ - General purpose, best compatibility
await create("./src", "./release.tar.gz", ArchiveFormat.TAR_GZ, {
  compression_level: 9,
  exclude_patterns: ["**/*.test.ts", "**/node_modules/**"],
});

// ZIP - Windows compatibility, random access
await create(["./config", "./scripts"], "./deploy.zip", ArchiveFormat.ZIP);

// GZIP - Single file compression
await create("./large-data.csv", "./large-data.csv.gz", ArchiveFormat.GZIP);
```

### Pathfinder - Repository Root Discovery

Find repository markers (`.git`, `package.json`, etc.) by walking up the directory tree with security-first design, boundary enforcement, and comprehensive error handling.

**Features:**

- Security-first design with boundary enforcement (home directory/explicit/filesystem root ceilings)
- Max depth limiting (default 10 levels) to prevent excessive traversal
- Symlink loop detection with opt-in following
- Path constraint validation for workspace boundaries
- Cross-platform support (POSIX root, Windows drives, UNC paths)
- Predefined marker sets for common ecosystems (Git, Node, Python, Go, Monorepo)
- Structured errors with context for debugging

**Basic Usage:**

```typescript
import {
  findRepositoryRoot,
  GitMarkers,
  NodeMarkers,
} from "@fulmenhq/tsfulmen/pathfinder";

// Find Git repository root from current directory
const gitRoot = await findRepositoryRoot(process.cwd(), GitMarkers);
console.log(`Git root: ${gitRoot}`);

// Find Node.js project root
const nodeRoot = await findRepositoryRoot("./src/components", NodeMarkers);
console.log(`Node root: ${nodeRoot}`);
```

**Predefined Marker Sets:**

```typescript
import {
  GitMarkers, // [".git"]
  NodeMarkers, // ["package.json", "package-lock.json"]
  PythonMarkers, // ["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"]
  GoModMarkers, // ["go.mod"]
  MonorepoMarkers, // ["lerna.json", "pnpm-workspace.yaml", "nx.json", "turbo.json", "rush.json"]
} from "@fulmenhq/tsfulmen/pathfinder";
```

**Security Boundaries:**

```typescript
import {
  ConstraintType,
  EnforcementLevel,
} from "@fulmenhq/tsfulmen/pathfinder";

// Secure search within project boundary
const root = await findRepositoryRoot("./src/components", GitMarkers, {
  boundary: "/home/user/projects/myapp", // Don't search above project
  constraint: {
    root: "/home/user/projects", // Enforce workspace constraint
    type: ConstraintType.WORKSPACE,
    enforcementLevel: EnforcementLevel.STRICT,
  },
});
```

**Monorepo Support:**

```typescript
// Find deepest marker (closest to filesystem root) for monorepo roots
// Directory: /monorepo/.git and /monorepo/packages/app/.git

// stopAtFirst=true (default) - finds /monorepo/packages/app
const packageRoot = await findRepositoryRoot(
  "/monorepo/packages/app/src/index.ts",
  GitMarkers,
);

// stopAtFirst=false - finds /monorepo (deepest/monorepo root)
const monorepoRoot = await findRepositoryRoot(
  "/monorepo/packages/app/src/index.ts",
  GitMarkers,
  { stopAtFirst: false },
);
```

**Error Handling:**

```typescript
import { PathfinderErrorCode } from "@fulmenhq/tsfulmen/pathfinder";

try {
  const root = await findRepositoryRoot("./src", GitMarkers);
  console.log(`Found: ${root}`);
} catch (error) {
  if (error.data?.code === PathfinderErrorCode.REPOSITORY_NOT_FOUND) {
    console.error("No repository marker found");
    console.error(`Searched from: ${error.data.context.startPath}`);
    console.error(`Max depth: ${error.data.context.maxDepth}`);
  } else if (error.data?.code === PathfinderErrorCode.TRAVERSAL_LOOP) {
    console.error("Cyclic symlink detected:", error.data.context);
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

**Default Behavior:**

- **`maxDepth`**: `10` - Prevents excessive traversal
- **`boundary`**: User home directory (if start path under home), otherwise filesystem root
- **`stopAtFirst`**: `true` - Returns first marker found (closest to start path)
- **`followSymlinks`**: `false` - Security: symlinks not followed by default
- **`constraint`**: `undefined` - No additional path constraints

See [Pathfinder README](src/pathfinder/README.md) for complete API documentation.

### Pathfinder - Filesystem Discovery

Enterprise filesystem traversal with pattern matching, ignore files, optional checksums, and comprehensive observability.

**Features:**

- Recursive directory scanning with glob patterns
- `.fulmenignore` and `.gitignore` support with nested precedence
- Optional FulHash checksums (xxh3-128, sha256) with streaming calculation
- Path constraint enforcement (WARN, STRICT, PERMISSIVE)
- Structured errors with correlation IDs and severity levels
- Telemetry metrics for observability (`pathfinder_find_ms`, `pathfinder_security_warnings`)
- Streaming results via async iterables for large directories
- Cross-platform support (Linux, macOS, Windows)

**Basic Usage:**

```typescript
import { Pathfinder } from "@fulmenhq/tsfulmen/pathfinder";

// Find all TypeScript files
const finder = new Pathfinder({
  root: "./src",
  includePatterns: ["**/*.ts"],
  excludePatterns: ["**/*.test.ts"],
});

const results = await finder.find();
console.log(`Found ${results.length} files`);
```

**With Checksums and Observability:**

```typescript
import { Pathfinder } from "@fulmenhq/tsfulmen/pathfinder";
import { createLogger } from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({ service: "file-discovery" });

const finder = new Pathfinder(
  {
    root: "./data",
    calculateChecksums: true,
    checksumAlgorithm: "xxh3-128",
    enforcementLevel: "STRICT",
  },
  { logger, correlationId: "scan-123" },
);

for await (const result of finder.findIterable()) {
  console.log(`${result.path}: ${result.metadata.checksum}`);
}
```

**PathfinderOptions Integration:**

The `PathfinderOptions` interface provides enterprise-grade configuration:

```typescript
import type { PathfinderOptions } from "@fulmenhq/tsfulmen/pathfinder";

const options: PathfinderOptions = {
  logger: createLogger({ service: "scanner" }),
  correlationId: "batch-scan-001",
  metrics: customMetricsRegistry,
};

const finder = new Pathfinder(config, options);
```

**Convenience Helpers:**

```typescript
import {
  findConfigFiles,
  findSchemaFiles,
  findByExtensions,
} from "@fulmenhq/tsfulmen/pathfinder";

// Find all config files (YAML, JSON by default)
const configs = await findConfigFiles("./config");

// Find all schema files
const schemas = await findSchemaFiles("./schemas");

// Find files by specific extensions
const markdownFiles = await findByExtensions("./docs", [".md", ".markdown"]);
```

**Enterprise Observability:**

Pathfinder automatically emits telemetry metrics:

- `pathfinder_find_ms` - Histogram of find operation duration
- `pathfinder_security_warnings` - Counter for constraint violations
- Structured errors with correlation IDs for distributed tracing
- Integration with TSFulmen's progressive logging system

## Testing

```bash
make test              # Run all tests
make test-watch        # Watch mode
make test-coverage     # With coverage report
```

## Contributing

Contributions are welcome! Please ensure:

- Code follows TypeScript standards and conventions
- Tests are included for new functionality
- Documentation is updated
- Changes are consistent with Crucible standards

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [TSFulmen Overview](docs/tsfulmen_overview.md) for architecture.

## Licensing

TSFulmen is licensed under MIT license - see [LICENSE](LICENSE) for complete details.

**Trademarks**: "Fulmen" and "3 Leaps" are trademarks of 3 Leaps, LLC. While code is open source, please use distinct names for derivative works to prevent confusion.

### OSS Policies (Organization-wide)

- Authoritative policies repository: https://github.com/3leaps/oss-policies/
- Code of Conduct: https://github.com/3leaps/oss-policies/blob/main/CODE_OF_CONDUCT.md
- Security Policy: https://github.com/3leaps/oss-policies/blob/main/SECURITY.md
- Contributing Guide: https://github.com/3leaps/oss-policies/blob/main/CONTRIBUTING.md

## Status

**Lifecycle Phase**: `alpha` ([Repository Lifecycle Standard](docs/crucible-ts/standards/repository-lifecycle.md))

- **Quality Bar**: 30% minimum test coverage (currently: 100%)
- **Stability**: Early adopters; rapidly evolving features
- **Breaking Changes**: Expected without deprecation warnings
- **Documentation**: Major gaps documented; kept current

See `LIFECYCLE_PHASE` file and [CHANGELOG.md](CHANGELOG.md) for version history.

---

<div align="center">

⚡ **TypeScript Foundation for the Fulmen Ecosystem** ⚡

_Enterprise-grade TypeScript access to Crucible standards, cross-platform signal handling, and progressive logging_

<br><br>

**Built with ⚡ by the 3 Leaps team**  
**Part of the [Fulmen Ecosystem](https://fulmenhq.dev) - Lightning-fast enterprise development**

**Crucible Integration** • **Signal Handling** • **Application Identity** • **Progressive Logging**

</div>
