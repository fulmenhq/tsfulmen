# Error Handling & Propagation Module

Schema-backed structured error handling with severity levels, correlation IDs, and context preservation for the Fulmen ecosystem.

## Features

- ✅ **Structured Errors**: Schema-validated error data model
- ✅ **Severity Levels**: Five-tier severity system (info → critical)
- ✅ **Correlation IDs**: UUID v4 for distributed tracing
- ✅ **Context Preservation**: Rich error context with stack traces
- ✅ **Error Wrapping**: Preserve error chains with cause support
- ✅ **Type Safety**: Full TypeScript support with readonly immutability
- ✅ **Schema Validation**: Validates against `error-response.schema.json`

## Severity Levels

| Level        | Numeric | Use Case                                      |
| ------------ | ------- | --------------------------------------------- |
| **info**     | 0       | Informational messages, FYI notifications     |
| **low**      | 1       | Minor issues, degraded performance            |
| **medium**   | 2       | Operational errors, retryable failures        |
| **high**     | 3       | Critical errors, data loss risk               |
| **critical** | 4       | System failures, immediate attention required |

## Quick Start

### Creating Structured Errors

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

// Create from scratch
const error = new FulmenError({
  code: "OPERATION_FAILED",
  message: "Database connection timeout",
  severity: "high",
  context: {
    database: "postgresql",
    timeout_ms: 5000,
  },
  exit_code: 1,
});

throw error;
```

### Wrapping Existing Errors

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

try {
  await loadConfig("/path/to/config.json");
} catch (err) {
  throw FulmenError.fromError(err, {
    code: "CONFIG_LOAD_FAILED",
    severity: "high",
    context: { file: "/path/to/config.json" },
  });
}
```

### Error Wrapping with Context

```typescript
import { FulmenError, ConfigPathError } from "@fulmenhq/tsfulmen";

try {
  const configDir = getAppConfigDir("myapp");
} catch (err) {
  const wrapped = FulmenError.wrap(err, {
    code: "CONFIG_PATH_ERROR",
    severity: "medium",
    context: { operation: "getConfigPath" },
  });
  console.error(wrapped.toJSON());
}
```

## API Reference

### FulmenError Class

#### `new FulmenError(data: FulmenErrorData)`

Create error from data object.

```typescript
const error = new FulmenError({
  code: "VALIDATION_FAILED",
  message: "Schema validation failed",
  severity: "medium",
  correlation_id: "550e8400-e29b-41d4-a716-446655440000",
});
```

**Required Fields**:

- `code`: Error code (e.g., `CONFIG_LOAD_FAILED`)
- `message`: Human-readable error message

**Optional Fields**:

- `severity`: Severity level (`info` | `low` | `medium` | `high` | `critical`)
- `severity_level`: Numeric severity (0-4, auto-computed from severity)
- `correlation_id`: UUID v4 for tracing
- `trace_id`: Distributed trace ID
- `context`: Additional error context (object)
- `user_message`: User-facing message
- `details`: Structured details (object)
- `exit_code`: Process exit code
- `timestamp`: ISO-8601 timestamp (auto-generated if not provided)
- `original`: Original error message/stack

#### `FulmenError.fromError(err, options): FulmenError`

Wrap native Error objects.

```typescript
try {
  JSON.parse(invalidJson);
} catch (err) {
  throw FulmenError.fromError(err, {
    code: "JSON_PARSE_ERROR",
    severity: "low",
    context: { input: invalidJson },
  });
}
```

**Automatically captures**:

- Original error message
- Stack trace
- Error name (stored in `context.originalName`)

#### `FulmenError.wrap(error, options): FulmenError`

Wrap existing FulmenError or FulmenErrorData with additional context.

```typescript
const base = FulmenError.fromError(new Error("Failed"), {
  code: "OPERATION_FAILED",
});

const wrapped = FulmenError.wrap(base, {
  severity: "high", // Override severity
  context: { retry_count: 3 }, // Add context
});
```

**Features**:

- Preserves existing error data
- Merges new options
- Recomputes severity_level when severity changes
- Updates timestamp

#### `FulmenError.validate(data): Promise<boolean>`

Validate error data against schema.

```typescript
const isValid = await FulmenError.validate({
  code: "TEST_ERROR",
  message: "Test message",
  severity: "low",
});

if (!isValid) {
  console.error("Validation failed");
}
```

#### `FulmenError.exitWithError(error, options?): never`

Log error and exit process.

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";
import { logger } from "./logger";

try {
  await criticalOperation();
} catch (err) {
  const fulmenError = FulmenError.fromError(err, {
    code: "CRITICAL_FAILURE",
    severity: "critical",
    exit_code: 1,
  });

  FulmenError.exitWithError(fulmenError, {
    logger: logger.error.bind(logger),
    exitCode: 1,
  });
  // Process exits here
}
```

### Instance Methods

#### `error.toJSON(): FulmenErrorData`

Serialize to schema-compliant JSON.

```typescript
const error = FulmenError.fromError(new Error("Failed"), {
  code: "OPERATION_FAILED",
  severity: "medium",
});

const json = error.toJSON();
console.log(JSON.stringify(json, null, 2));
```

#### `error.equals(other): boolean`

Deep equality check.

```typescript
const error1 = new FulmenError({ code: "TEST", message: "Test" });
const error2 = new FulmenError({ code: "TEST", message: "Test" });

error1.equals(error2); // true if data matches
```

### Properties

```typescript
error.data.code; // Error code
error.data.message; // Error message
error.data.severity; // Severity name
error.data.severity_level; // Numeric level (0-4)
error.data.correlation_id; // UUID v4 (if set)
error.data.context; // Error context object
error.data.timestamp; // ISO-8601 timestamp
```

## Error Serialization

### JSON Format

All FulmenError instances serialize to schema-compliant JSON:

```json
{
  "code": "CONFIG_LOAD_FAILED",
  "message": "Failed to load configuration file",
  "severity": "high",
  "severity_level": 3,
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-24T16:00:00.000Z",
  "context": {
    "file": "/path/to/config.json",
    "originalName": "Error",
    "stack": "Error: Failed...\n    at loadConfig..."
  },
  "exit_code": 1
}
```

### Schema Validation

Errors validate against `schemas/crucible-ts/error-handling/v1.0.0/error-response.schema.json`:

```typescript
import { assertValidFulmenError } from "@fulmenhq/tsfulmen/errors";

const errorData = {
  code: "VALIDATION_FAILED",
  message: "Schema validation failed",
  severity: "medium",
};

await assertValidFulmenError(errorData);
// Throws if invalid
```

## Severity System

### Automatic Level Computation

Severity levels are automatically computed from severity names:

```typescript
const error = new FulmenError({
  code: "TEST",
  message: "Test",
  severity: "high", // String severity
});

console.log(error.data.severity_level); // 3 (auto-computed)
```

### Default Severity

If not specified, severity defaults to `medium` (level 2):

```typescript
const error = new FulmenError({
  code: "TEST",
  message: "Test",
  // No severity specified
});

console.log(error.data.severity); // 'medium'
console.log(error.data.severity_level); // 2
```

### Severity Utilities

```typescript
import {
  severityToLevel,
  levelToSeverity,
  getDefaultSeverity,
} from "@fulmenhq/tsfulmen/errors";

// Convert severity name to level
const level = severityToLevel("high"); // 3

// Convert level to severity name
const severity = levelToSeverity(3); // 'high'

// Get default severity
const defaultSev = getDefaultSeverity(); // { name: 'medium', level: 2 }
```

## Correlation IDs

### Automatic Generation

```typescript
import { generateCorrelationId } from "@fulmenhq/tsfulmen/errors";

const correlationId = generateCorrelationId();
// e.g., '550e8400-e29b-41d4-a716-446655440000'

const error = new FulmenError({
  code: "OPERATION_FAILED",
  message: "Failed",
  correlation_id: correlationId,
});
```

### Correlation Across Operations

```typescript
import { generateCorrelationId, FulmenError } from "@fulmenhq/tsfulmen/errors";

const correlationId = generateCorrelationId();

async function operation1() {
  try {
    // ... operation
  } catch (err) {
    throw FulmenError.fromError(err, {
      code: "OP1_FAILED",
      correlation_id: correlationId,
    });
  }
}

async function operation2() {
  try {
    await operation1();
  } catch (err) {
    // Preserve correlation ID
    throw FulmenError.wrap(err, {
      code: "OP2_FAILED",
      context: { step: "operation2" },
    });
  }
}
```

## Type Guards

```typescript
import { isFulmenError, isFulmenErrorData } from "@fulmenhq/tsfulmen/errors";

// Check if value is FulmenError instance
if (isFulmenError(error)) {
  console.log(error.data.code);
}

// Check if value is FulmenErrorData
if (isFulmenErrorData(data)) {
  console.log(data.code, data.message);
}
```

## Integration Patterns

### With Config Module

```typescript
import { ConfigPathError } from "@fulmenhq/tsfulmen/config";
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

try {
  const configDir = getAppConfigDir("myapp");
} catch (err) {
  if (err instanceof ConfigPathError) {
    throw FulmenError.wrap(err, {
      code: "CONFIG_PATH_INVALID",
      severity: "medium",
    });
  }
  throw err;
}
```

### With Schema Validation

```typescript
import { SchemaValidationError } from "@fulmenhq/tsfulmen/schema";
import { FulmenError } from "@fulmenhq/tsfulmen/errors";

try {
  await validateData(schema, data);
} catch (err) {
  if (err instanceof SchemaValidationError) {
    throw FulmenError.wrap(err, {
      code: "SCHEMA_VALIDATION_FAILED",
      severity: "high",
      context: {
        schema_id: schema.id,
        error_count: err.diagnostics.length,
      },
    });
  }
  throw err;
}
```

### With Telemetry

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

try {
  await performOperation();
} catch (err) {
  metrics.counter("operation_errors").inc();

  throw FulmenError.fromError(err, {
    code: "OPERATION_FAILED",
    severity: "high",
  });
}
```

## Error Context Best Practices

### Include Relevant Context

```typescript
throw FulmenError.fromError(err, {
  code: "DATABASE_CONNECTION_FAILED",
  severity: "critical",
  context: {
    host: "db.example.com",
    port: 5432,
    database: "myapp",
    timeout_ms: 5000,
    retry_count: 3,
  },
});
```

### Avoid Sensitive Data

```typescript
// ❌ BAD: Includes password
throw FulmenError.fromError(err, {
  code: "AUTH_FAILED",
  context: {
    username: "admin",
    password: "secret123", // ❌ Never include secrets
  },
});

// ✅ GOOD: Only non-sensitive data
throw FulmenError.fromError(err, {
  code: "AUTH_FAILED",
  context: {
    username: "admin",
    auth_method: "password",
  },
});
```

## Testing

```bash
# Run all error tests
bunx vitest run src/errors/__tests__/

# Run specific test suites
bunx vitest run src/errors/__tests__/fulmen-error.test.ts  # Core error class
bunx vitest run src/errors/__tests__/severity.test.ts      # Severity mapping
bunx vitest run src/errors/__tests__/wrapping.test.ts      # Error wrapping
bunx vitest run src/errors/__tests__/serialization.test.ts # JSON serialization
```

## Cross-Language Compatibility

FulmenError maintains API parity with:

- **pyfulmen** (Python): `FulmenError` class with same data model
- **gofulmen** (Go): `FulmenError` struct with identical fields

All implementations share:

- Same severity levels (info=0, low=1, medium=2, high=3, critical=4)
- Same schema validation (`error-response.schema.json`)
- Same JSON serialization format
- Compatible test fixtures in `tests/fixtures/errors/`

## Documentation

- **Standard**: [Error Handling & Propagation](../../docs/crucible-ts/standards/library/modules/error-handling-propagation.md)
- **ADR-0006**: Error Handling Data Model
- **Schema**: `schemas/crucible-ts/error-handling/v1.0.0/error-response.schema.json`
- **Fixtures**: `tests/fixtures/errors/`

## Implementation Status

- ✅ FulmenError data model (8 tests)
- ✅ Error wrapping patterns (6 tests)
- ✅ JSON serialization (5 tests)
- ✅ Severity mapping (4 tests)
- ✅ Type guards (3 tests)
- ✅ Exit behavior (4 tests)
- ✅ Schema validation (13 tests)

**Total**: 43 tests passing

## See Also

- [Telemetry Module](../telemetry/README.md)
- [Schema Validation](../schema/README.md)
- [Config Module](../../docs/crucible-ts/standards/library/modules/config-path-api.md)
- [Example Script](../../examples/error-telemetry-demo.ts)
