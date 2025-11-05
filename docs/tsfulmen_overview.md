---
title: "TSFulmen Overview"
description: "Architecture overview and module catalog for the TypeScript Fulmen helper library"
author: "Module Weaver"
date: "2025-10-11"
status: "draft"
tags: ["architecture", "overview", "typescript", "modules"]
---

# TypeScript Fulmen Overview

## Purpose & Scope

TSFulmen is the TypeScript/Node.js foundation library within the FulmenHQ ecosystem, providing ergonomic access to Crucible SSOT assets and core utilities for building enterprise-grade applications. It delivers cross-platform configuration management, schema validation, structured logging, and pattern catalogs with full type safety and modern ESM/CJS dual exports.

**Supported Environments:**

- Node.js 18+ (LTS)
- Bun 1.0+
- TypeScript 5.0+
- Platforms: Linux, macOS, Windows

**Package**: `@fulmenhq/tsfulmen`  
**Repository**: https://github.com/fulmenhq/tsfulmen  
**License**: MIT

## Module Catalog

| Module                 | Tier      | Status         | Summary                                                                                 | Spec Link                                                                             |
| ---------------------- | --------- | -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **app-identity**       | Core      | ✅ Implemented | Application identity loading from `.fulmen/app.yaml` with schema validation and caching | [app-identity](crucible-ts/standards/library/modules/app-identity.md)                 |
| **config-path-api**    | Core      | ✅ Implemented | Platform-aware config/data/cache directory discovery with XDG support                   | [config-path-api](crucible-ts/standards/library/modules/config-path-api.md)           |
| **crucible-shim**      | Core      | 🚧 Planned     | Typed access to embedded Crucible assets (schemas, docs, config)                        | [crucible-shim](crucible-ts/standards/library/modules/crucible-shim.md)               |
| **docscribe**          | Core      | 🚧 In Progress | Source-agnostic doc processing (frontmatter, headers, format detection, splitting)      | [docscribe](crucible-ts/standards/library/modules/docscribe.md)                       |
| **error-handling**     | Core      | ✅ Implemented | Schema-backed structured error handling with severity levels and correlation            | [error-handling](crucible-ts/standards/library/modules/error-handling-propagation.md) |
| **schema-validation**  | Core      | ✅ Implemented | JSON Schema validation utilities using AJV and goneat integration                       | [schema-validation](crucible-ts/standards/library/modules/schema-validation.md)       |
| **telemetry-metrics**  | Core      | ✅ Implemented | Counter/gauge/histogram metrics with OTLP-compatible export and taxonomy enforcement    | [telemetry-metrics](crucible-ts/standards/library/modules/telemetry-metrics.md)       |
| **three-layer-config** | Core      | 🚧 Planned     | Layered configuration loading (defaults → user → runtime)                               | [three-layer-config](crucible-ts/standards/library/modules/three-layer-config.md)     |
| **foundry**            | Core      | ✅ Implemented | Pattern catalogs (regex/glob), HTTP statuses, MIME types, country codes, exit codes     | [foundry](crucible-ts/standards/library/foundry/README.md)                            |
| **signal-handling**    | Core      | ✅ Implemented | Cross-platform signal handling with graceful shutdown, config reload, Windows fallback  | [signal-handling](crucible-ts/standards/library/modules/signal-handling.md)           |
| **logging**            | Core      | ✅ Implemented | Progressive logging interface with Pino (SIMPLE/STRUCTURED/ENTERPRISE/CUSTOM profiles)  | [logging](crucible-ts/standards/observability/logging.md)                             |
| **pathfinder**         | Core      | ✅ Implemented | Filesystem traversal with checksums, ignore files, and observability                    | [pathfinder](crucible-ts/standards/library/extensions/pathfinder.md)                  |
| **ssot-sync**          | Core      | 🚧 Planned     | Programmatic SSOT synchronization API wrapping goneat                                   | [ssot-sync](crucible-ts/standards/library/modules/ssot-sync.md)                       |
| **ascii-helpers**      | Extension | 📋 Future      | Terminal formatting and box drawing characters                                          | [ascii-helpers](crucible-ts/standards/library/extensions/ascii-helpers.md)            |

**Legend:**

- ✅ Implemented (v0.1.3-v0.1.5)
- 🚧 Planned (v0.1.6+)
- 📋 Future (post-v0.1.x)

## Error Handling & Propagation

TSFulmen implements the Crucible Error Handling & Propagation standard (ADR-0006) with schema-backed structured errors.

### FulmenError Data Model

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

// Wrap existing errors
try {
  throw new Error("Config file not found");
} catch (err) {
  const fulmenError = FulmenError.fromError(err, {
    code: "CONFIG_NOT_FOUND",
    severity: "high",
    context: { file: "/path/to/config.json" },
  });
  throw fulmenError;
}
```

### Key Features

- **Severity Levels**: `info` (0), `low` (1), `medium` (2), `high` (3), `critical` (4)
- **Correlation IDs**: UUID v4 for distributed tracing
- **Context Preservation**: Rich error context with stack traces
- **Schema Validation**: All errors validate against `error-response.schema.json`
- **Immutability**: Readonly error data for safe propagation

### Error Wrapping Patterns

```typescript
// Wrap with additional context
const wrapped = FulmenError.wrap(originalError, {
  code: "VALIDATION_FAILED",
  severity: "medium",
  context: { schema_id: "metrics-event" },
});

// Create from scratch
const error = new FulmenError({
  code: "OPERATION_FAILED",
  message: "Operation timed out",
  severity: "high",
  exit_code: 1,
});
```

See [Error Handling Standard](crucible-ts/standards/library/modules/error-handling-propagation.md) for complete API reference.

## Signal Handling & Graceful Shutdown

TSFulmen implements the Crucible Signal Handling standard (v1.0.0) with cross-platform support, graceful shutdown patterns, and Windows fallback strategies.

### Signal Manager

```typescript
import {
  createSignalManager,
  onShutdown,
  onReload,
} from "@fulmenhq/tsfulmen/foundry";

// Create signal manager
const manager = createSignalManager({
  logger,
  telemetry,
  handlerTimeout: 30000, // 30s default
});

// Register graceful shutdown handlers (SIGTERM, SIGINT)
onShutdown(manager, async () => {
  await db.close();
  await server.close();
  console.log("Graceful shutdown complete");
});

// Register config reload handler (SIGHUP)
onReload(manager, async () => {
  const newConfig = await loadConfig();
  await applyConfig(newConfig);
  console.log("Config reloaded successfully");
});
```

### Windows Fallback

On Windows, unsupported signals (SIGHUP, SIGUSR1, SIGUSR2) automatically fall back to HTTP-based triggering:

```typescript
import {
  createSignalEndpoint,
  createBearerTokenAuth,
} from "@fulmenhq/tsfulmen/foundry";

// Create HTTP endpoint for Windows signal fallback
const handler = createSignalEndpoint({
  manager,
  auth: createBearerTokenAuth(process.env.ADMIN_TOKEN),
  rateLimit: createSimpleRateLimiter(10), // 10 req/min
});

// Wire to Express/Fastify
app.post("/admin/signal", async (req, res) => {
  const result = await handler(req.body, req);
  res.status(result.status === "accepted" ? 202 : 400).json(result);
});
```

### Double-Tap Exit

Ctrl+C (SIGINT) implements double-tap logic with 2-second debounce:

- First tap: Initiates graceful shutdown
- Second tap (within 2s): Forces immediate exit with code 130

See [Signal Handling Standard](crucible-ts/standards/library/modules/signal-handling.md) for complete API reference.

## Telemetry & Metrics Export

TSFulmen implements the Telemetry & Metrics standard with support for counters, gauges, and histograms.

### Metrics Registry

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

// Counter: monotonic incrementing values
metrics.counter("schema_validations").inc();
metrics.counter("config_load_errors").inc(2);

// Gauge: arbitrary values (can go up or down)
metrics.gauge("foundry_lookup_count").set(42);

// Histogram: distribution of values with automatic bucketing
metrics.histogram("config_load_ms").observe(125.5);

// Export all metrics
const events = await metrics.export();
console.log(JSON.stringify(events, null, 2));

// Flush: export and clear
await metrics.flush({
  emit: (events) => logger.info({ metrics: events }),
});
```

### ADR-0007 Default Buckets

Metrics ending with `_ms` automatically apply ADR-0007 histogram buckets:
`[1, 5, 10, 50, 100, 500, 1000, 5000, 10000]` milliseconds

### Taxonomy-Backed Metrics

All metric names are validated against `config/crucible-ts/taxonomy/metrics.yaml`:

- `schema_validations`, `schema_validation_errors`
- `config_load_ms`, `config_load_errors`
- `pathfinder_find_ms`, `pathfinder_validation_errors`, `pathfinder_security_warnings`
- `foundry_lookup_count`
- `logging_emit_count`, `logging_emit_latency_ms`
- `goneat_command_duration_ms`

### OTLP-Compatible Export

Histograms use cumulative bucket counts compatible with OpenTelemetry Protocol (OTLP):

```json
{
  "timestamp": "2025-10-24T16:00:00.000Z",
  "name": "config_load_ms",
  "value": {
    "count": 10,
    "sum": 523.5,
    "buckets": [
      { "le": 10, "count": 3 },
      { "le": 50, "count": 7 },
      { "le": 100, "count": 9 }
    ]
  },
  "unit": "ms"
}
```

See [Telemetry Standard](crucible-ts/standards/library/modules/telemetry-metrics.md) for complete API reference.

## Observability & Logging Integration

### Progressive Logging Profiles

TSFulmen implements the Crucible progressive logging standard with four profiles:

| Profile        | Use Case              | Features                                                                    |
| -------------- | --------------------- | --------------------------------------------------------------------------- |
| **SIMPLE**     | CLI tools, scripts    | Console output, basic severity levels, zero config                          |
| **STRUCTURED** | API services, jobs    | JSON output, correlation IDs, file sinks                                    |
| **ENTERPRISE** | Production workhorses | Full envelope (20+ fields), middleware pipeline, throttling, multiple sinks |
| **CUSTOM**     | Specialized needs     | Full control via custom configuration                                       |

### Default Configuration

- **Profile**: SIMPLE (for CLI tools)
- **Policy Search Order**: `.goneat/logging-policy.yaml` → `/etc/fulmen/logging-policy.yaml` → `/org/logging-policy.yaml`
- **Built-in Middleware**: `redact-secrets`, `redact-pii`, `correlation`, `throttle`
- **Sink Types**: `console` (stderr), `file`, `rolling-file`, `external` (HTTP endpoint)

### Policy Enforcement

Organizations can enforce logging standards via YAML policy files:

```yaml
allowedProfiles: [STRUCTURED, ENTERPRISE]
requiredProfiles:
  workhorse: [ENTERPRISE]
environmentRules:
  production: [ENTERPRISE]
```

See [`schemas/crucible-ts/observability/logging/v1.0.0/logging-policy.schema.json`](../schemas/crucible-ts/observability/logging/v1.0.0/logging-policy.schema.json) for full policy schema.

## Dependency Map

| Artifact                 | Description                  | Source                                                                              |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------- |
| **Crucible schemas**     | JSON schemas for validation  | Synced via `goneat ssot sync` from [crucible](https://github.com/fulmenhq/crucible) |
| **Crucible docs**        | Standards, guides, SOPs      | Synced via `goneat ssot sync` from [crucible](https://github.com/fulmenhq/crucible) |
| **Crucible config**      | Default configurations       | Synced via `goneat ssot sync` from [crucible](https://github.com/fulmenhq/crucible) |
| **Published package**    | `@fulmenhq/tsfulmen`         | npm (pending first release)                                                         |
| **Goneat CLI**           | Schema validation, SSOT sync | Installed via `.goneat/tools.yaml`                                                  |
| **Runtime dependencies** | Zero (dev dependencies only) | -                                                                                   |

### Development Dependencies

- **Build**: `tsup` (bundler), `typescript` (compiler)
- **Testing**: `vitest` (test runner), `@vitest/coverage-v8` (coverage)
- **Quality**: `@biomejs/biome` (linter/formatter)
- **Validation**: `ajv` (JSON Schema), `ajv-formats` (format validators)
- **Logging**: `pino` (structured logging), `pino-pretty` (dev formatting)
- **Utilities**: `yaml` (YAML parsing), `deepmerge-ts` (config merging)

## Architecture Highlights

### Type Safety First

- TypeScript strict mode enabled
- Discriminated unions for profile-specific configurations
- Generic type support for extensibility
- Comprehensive JSDoc documentation

### Zero Runtime Dependencies

- All runtime dependencies are peer dependencies
- Minimal bundle size for production deployments
- Tree-shakeable ESM exports

### Cross-Platform Support

- XDG Base Directory specification (Linux)
- Apple guidelines (macOS)
- Windows special folders (APPDATA, LOCALAPPDATA)
- Consistent API across all platforms

### Developer Experience

- IntelliSense support with auto-completion
- Compile-time validation
- Builder pattern for complex configurations
- Clear error messages with suggestions

## Roadmap & Known Gaps

### v0.1.2 (Current Release - October 2025)

- [x] Error Handling & Propagation - Schema-backed FulmenError (43 tests)
- [x] Telemetry & Metrics - Counter/gauge/histogram with OTLP export (85 tests)
- [x] Progressive Logging - Policy enforcement with Pino (83 tests)
- [x] Integration Tests - Error + telemetry workflows (17 tests)
- [x] Cross-language fixtures - Shared error/metrics test data
- [x] Comprehensive test coverage (991 passing tests, 1011 total)

### v0.1.1 (Previous Release)

- [x] Config Path API - XDG-compliant directories (26 tests)
- [x] Schema Validation - JSON Schema 2020-12 with AJV + CLI (115 tests)
- [x] Foundry Module - Patterns, HTTP statuses, MIME detection (151 tests)
- [x] Cross-platform support (Linux/macOS/Windows)

### v0.1.3+ (Next - Remaining Core Modules)

- [ ] Crucible Shim - Typed SSOT asset access
- [ ] Three-Layer Config - Defaults → User → Runtime
- [ ] SSOT Sync - Programmatic goneat wrapper
- [ ] Pathfinder - Path finding and traversal utilities (Phase 4 observability complete; see [Pathfinder Options](development/pathfinder-options.md))
- [ ] Cross-language parity with gofulmen/pyfulmen

### v0.2.0 (Future)

- [ ] ASCII helpers extension
- [ ] Cloud storage abstractions
- [ ] Distributed tracing integration
- [ ] Performance optimizations (< 5% overhead target met)
- [ ] Bundle size reduction

### Known Limitations

- Taxonomy YAML references in schemas require Schema Cartographer enhancement (16 failing validator tests)
- Asset embedding system not yet implemented
- Limited to Node.js/Bun environments (no browser support)
- Policy enforcement requires file system access

## Cross-Language Coordination

TSFulmen maintains API parity with sibling libraries:

- **gofulmen** - Reference implementation (Go)
- **pyfulmen** - Python implementation
- **Future**: rsfulmen (Rust), csfulmen (C#)

Weekly coordination ensures:

- Consistent module interfaces
- Shared test fixtures
- Aligned policy formats
- Common documentation patterns

## Getting Started

```bash
# Install
bun add @fulmenhq/tsfulmen  # (pending first release)

# Basic usage
import { VERSION } from '@fulmenhq/tsfulmen';
console.log(`TSFulmen ${VERSION}`);

# Error handling
import { FulmenError } from '@fulmenhq/tsfulmen/errors';
const error = FulmenError.fromError(new Error('Failed'), {
  code: 'OPERATION_FAILED',
  severity: 'high'
});

# Metrics collection
import { metrics } from '@fulmenhq/tsfulmen/telemetry';
metrics.counter('operations').inc();
metrics.histogram('operation_duration_ms').observe(125);

# Progressive logging
import { Logger, LoggingProfile } from '@fulmenhq/tsfulmen/logging';
const logger = new Logger({
  service: 'myapp',
  profile: LoggingProfile.SIMPLE
});
logger.info('Hello from TSFulmen!');
```

See [README.md](../README.md) for complete installation and usage instructions.

### Example Script

Run the complete error + telemetry demo:

```bash
bunx tsx examples/error-telemetry-demo.ts
```

This demonstrates:

- Error wrapping with FulmenError
- Metrics collection across operations
- Integration with config loading and schema validation
- OTLP-compatible metrics export

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines, testing requirements, and contribution process.

## Support

- **Issues**: https://github.com/fulmenhq/tsfulmen/issues
- **Discussions**: https://github.com/fulmenhq/tsfulmen/discussions
- **Mattermost**: `#agents-tsfulmen` (provisioning in progress)
- **Maintainer**: @3leapsdave

---

**Last Updated**: October 24, 2025  
**Version**: 0.1.2 (current)  
**Status**: Error handling & telemetry complete, ready for Pathfinder integration
