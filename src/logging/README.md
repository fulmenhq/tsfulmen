# TSFulmen Logging

Progressive logging interface with policy enforcement, middleware support, and secure defaults.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Logging Profiles](#logging-profiles)
- [Middleware Support](#middleware-support)
- [Secure Redaction](#secure-redaction)
- [Progressive Interface](#progressive-interface)
- [Policy Enforcement](#policy-enforcement)
- [Performance](#performance)
- [API Reference](#api-reference)

## Overview

TSFulmen logging provides three progressive profiles to match your application's complexity:

1. **SIMPLE** - Human-readable output for CLI tools
2. **STRUCTURED** - JSON output with middleware support (new: redaction enabled)
3. **ENTERPRISE** - Full observability pipeline with sinks and transforms

All profiles use Pino internally for performance, with gofulmen-aligned defaults for cross-language consistency.

## Quick Start

### Basic Logging

```typescript
import { createLogger, LoggingProfile } from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.SIMPLE,
});

logger.info("Server started", { port: 3000 });
logger.error("Connection failed", { error: "ETIMEDOUT" });
```

### Structured Logging with Redaction

```typescript
import { createStructuredLoggerWithRedaction } from "@fulmenhq/tsfulmen/logging";

// Secure by default - redaction enabled
const logger = createStructuredLoggerWithRedaction("api-server");

logger.info("User login", {
  userId: "user-123",
  email: "user@example.com", // ← Redacted automatically
  password: "secret123", // ← Redacted automatically
  apiKey: "sk_live_1234567890", // ← Redacted automatically
});
```

**Output** (secrets redacted):

```json
{
  "severity": "INFO",
  "timestamp": "2025-11-18T12:00:00.000Z",
  "service": "api-server",
  "message": "User login",
  "userId": "user-123",
  "email": "[REDACTED]",
  "password": "[REDACTED]",
  "apiKey": "[REDACTED]"
}
```

## Logging Profiles

### SIMPLE Profile

Human-readable output for CLI tools and development.

```typescript
import { createSimpleLogger } from "@fulmenhq/tsfulmen/logging";

const logger = createSimpleLogger("mycli");
logger.info("Processing file", { path: "/data/input.csv" });
```

**Output**:

```json
{
  "severity": "INFO",
  "timestamp": "...",
  "service": "mycli",
  "message": "Processing file",
  "path": "/data/input.csv"
}
```

**Use Cases**:

- Command-line tools
- Local development
- Scripts and utilities

### STRUCTURED Profile

JSON output with optional middleware for production applications.

```typescript
import { createStructuredLogger } from "@fulmenhq/tsfulmen/logging";

const logger = createStructuredLogger("api-gateway");
logger.info("Request processed", { requestId: "req-456", duration: 42 });
```

**Use Cases**:

- Web servers and APIs
- Microservices
- Production applications with log aggregation

**New in v0.1.11**: Middleware support for redaction, field injection, and transforms.

### ENTERPRISE Profile

Full observability pipeline with custom sinks and middleware chains.

```typescript
import {
  createEnterpriseLogger,
  FileSink,
  RedactSecretsMiddleware,
} from "@fulmenhq/tsfulmen/logging";

const logger = createEnterpriseLogger("enterprise-app", {
  sinks: [new FileSink("/var/log/app.log")],
  middleware: [new RedactSecretsMiddleware()],
});
```

**Use Cases**:

- Large-scale distributed systems
- Compliance-heavy environments
- Custom logging pipelines

## Middleware Support

### Overview

Middleware allows you to transform log events before emission. As of v0.1.11, both **STRUCTURED** and **ENTERPRISE** profiles support middleware pipelines.

**Key Capabilities**:

- Redact sensitive data (secrets, PII)
- Inject context fields (request IDs, trace IDs)
- Transform event structure
- Adjust severity levels
- Chain multiple middleware

### Middleware Execution Model

Middleware executes in order before the log event reaches Pino:

```
Log Event → Middleware 1 → Middleware 2 → ... → Pino → Output
```

**Child Logger Behavior**:

- Child loggers inherit the parent's middleware chain
- Child loggers inherit and merge bindings (child bindings override parent)
- Middleware executes identically for parent and child loggers

**Severity Adjustment**:

- Middleware can modify event severity
- The `finalSeverity` from middleware output is honored
- Use cases: downgrade noisy errors to warnings, upgrade critical info to error

### Built-in Middleware

#### RedactSecretsMiddleware

Redacts sensitive data using field names and regex patterns.

```typescript
import {
  createLogger,
  LoggingProfile,
  RedactSecretsMiddleware,
} from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.STRUCTURED,
  middleware: [
    new RedactSecretsMiddleware({
      secretKeys: ["password", "apiKey"], // Custom field names
      patterns: [/SECRET_[A-Z0-9_]+/g], // Custom patterns
      useDefaultPatterns: true, // Include gofulmen defaults
    }),
  ],
});

logger.info("Config loaded", {
  dbUrl: "postgres://localhost",
  dbPassword: "secret123", // ← Redacted
  apiKey: "sk_live_abc", // ← Redacted
  env: "My SECRET_API_KEY=xyz", // ← Pattern redacted
});
```

**Default Field Names** (case-insensitive):

- `password`, `token`, `apiKey`, `api_key`
- `authorization`, `secret`
- `cardNumber`, `card_number`, `cvv`, `ssn`
- `accessToken`, `access_token`, `refreshToken`, `refresh_token`

**Default Patterns**:

- `SECRET_[A-Z0-9_]+` - Environment variable secrets
- `[A-Z0-9_]*TOKEN[A-Z0-9_]*` - Token variants
- `[A-Z0-9_]*KEY[A-Z0-9_]*` - Key variants
- `[A-Za-z0-9+/]{40,}={0,2}` - Base64 blobs (40+ chars)
- `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` - Email addresses
- `\b\d{13,19}\b` - Credit card numbers

**Gofulmen Alignment**: Default patterns and fields match gofulmen for cross-language consistency.

#### AddFieldsMiddleware

Injects additional fields into log events.

```typescript
import { AddFieldsMiddleware } from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.STRUCTURED,
  middleware: [
    new AddFieldsMiddleware({
      environment: "production",
      region: "us-east-1",
      version: "1.2.3",
    }),
  ],
});

logger.info("Request processed");
// Output includes: environment, region, version fields
```

#### TransformMiddleware

Transforms log event structure with custom logic.

```typescript
import { TransformMiddleware } from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.STRUCTURED,
  middleware: [
    new TransformMiddleware((event) => ({
      ...event,
      // Uppercase all messages
      message: event.message.toUpperCase(),
      // Add computed field
      processedAt: Date.now(),
    })),
  ],
});
```

### Middleware Chains

Combine multiple middleware for complex pipelines:

```typescript
import {
  RedactSecretsMiddleware,
  AddFieldsMiddleware,
  TransformMiddleware,
} from "@fulmenhq/tsfulmen/logging";

const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.STRUCTURED,
  middleware: [
    // 1. Redact secrets first
    new RedactSecretsMiddleware(),
    // 2. Add context fields
    new AddFieldsMiddleware({ requestId: "req-123" }),
    // 3. Transform structure
    new TransformMiddleware((event) => ({
      ...event,
      tags: ["api", "production"],
    })),
  ],
});
```

**Execution Order**: Middleware executes left-to-right (index 0 → N).

## Secure Redaction

### createStructuredLoggerWithRedaction()

Convenience helper for structured logging with secure defaults.

```typescript
import { createStructuredLoggerWithRedaction } from "@fulmenhq/tsfulmen/logging";

const logger = createStructuredLoggerWithRedaction("api-server");
```

**Security Model**: **Redaction enabled by default**. This helper automatically applies `RedactSecretsMiddleware` with gofulmen-aligned patterns for secure-by-default logging.

### Customization Options

#### Custom Patterns

Add organization-specific patterns while keeping defaults:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server", {
  customPatterns: [
    /INTERNAL_ID_\d+/g, // Internal IDs
    /CUST_[A-Z0-9]{10}/g, // Customer codes
  ],
  // useDefaultPatterns: true (implicit)
});
```

#### Custom Fields

Add application-specific field names:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server", {
  customFields: ["internalKey", "customerSecret", "encryptionKey"],
});
```

#### Opt-Out (Custom Only)

Disable default patterns for full control:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server", {
  useDefaultPatterns: false,
  customPatterns: [/MY_CUSTOM_SECRET/g],
  customFields: ["mySecret"],
});
```

**Warning**: Disabling defaults removes protection for common secrets (tokens, API keys, emails, credit cards). Only use when you need complete pattern control.

#### With File Output

Combine redaction with file logging:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server", {
  filePath: "/var/log/api.log",
});
```

### Child Loggers with Redaction

Child loggers automatically inherit the parent's middleware chain:

```typescript
const parent = createStructuredLoggerWithRedaction("api-server");
const child = parent.child({ requestId: "req-789" });

child.info("Processing request", {
  password: "secret123", // ← Still redacted!
  userId: "user-456", // ← Visible
});
```

**Inheritance Rules**:

1. Child inherits parent's middleware chain (exact same pipeline)
2. Child merges bindings (child bindings override parent on conflict)
3. Middleware executes identically for child and parent

## Progressive Interface

### Zero-Complexity Default

Start simple, add features as needed:

```typescript
// Level 1: Simple logger
const logger = createSimpleLogger("mycli");

// Level 2: Structured JSON
const logger2 = createStructuredLogger("myapp");

// Level 3: Structured + redaction
const logger3 = createStructuredLoggerWithRedaction("myapp");

// Level 4: Enterprise pipeline
const logger4 = createEnterpriseLogger("myapp", {
  sinks: [new FileSink("/var/log/app.log")],
  middleware: [
    new RedactSecretsMiddleware(),
    new AddFieldsMiddleware({ env: "prod" }),
  ],
});
```

### When to Use Each Profile

| Profile                    | Use When                         | Example Applications                                     |
| -------------------------- | -------------------------------- | -------------------------------------------------------- |
| **SIMPLE**                 | Human-readable output needed     | CLI tools, dev scripts, utilities                        |
| **STRUCTURED**             | JSON logs with optional security | APIs, web servers, microservices                         |
| **STRUCTURED + Redaction** | Handling sensitive data          | Authentication services, payment processing              |
| **ENTERPRISE**             | Custom pipelines required        | Distributed systems, compliance apps, multi-sink logging |

## Policy Enforcement

### Policy Files

Control logging behavior via YAML policy files:

```yaml
# policy.yaml
service: api-server
profile: STRUCTURED
minLevel: info
allowedFields:
  - requestId
  - userId
  - duration
forbiddenFields:
  - password
  - apiKey
requireMiddleware: true
```

### Enforcing Policies

```typescript
import { PolicyEnforcer } from "@fulmenhq/tsfulmen/logging";

const enforcer = new PolicyEnforcer("/path/to/policy.yaml");
const logger = enforcer.createLogger();
// Logger automatically configured per policy
```

**Use Cases**:

- Centralized logging standards
- Compliance requirements
- Multi-team consistency
- Production guardrails

## Performance

### Pino Backend

All profiles use [Pino](https://getpino.io/) for fast, structured logging. Pino is one of the fastest Node.js loggers.

### Pattern Scanning Guard

**10KB Threshold**: `RedactSecretsMiddleware` skips pattern scanning for strings larger than 10KB to avoid performance degradation on large payloads.

```typescript
// Automatic optimization
const logger = createStructuredLoggerWithRedaction("api-server");

logger.info("Large payload", {
  data: veryLargeString, // > 10KB
  // ↑ Field-based redaction still applies
  // ↑ Pattern scanning skipped for performance
});
```

**Rationale**: Pattern regex scanning has O(n) complexity. For large strings (multi-MB JSON blobs, base64 images), scanning can impact throughput. Field-based redaction (O(1) lookup) still applies.

**Override**: If you need pattern scanning on large strings, split into smaller chunks or use custom middleware.

### Middleware Overhead

Middleware adds minimal overhead (<5% for typical log events):

```typescript
// Benchmark: 10,000 log events
// No middleware:         ~2.5ms
// With redaction:        ~2.6ms (4% overhead)
```

**Optimization Tips**:

1. Minimize middleware chain length
2. Avoid expensive transforms in hot paths
3. Use child loggers to bind context (cheaper than per-log fields)

### Built-in Optimizations

- **Case-insensitive field lookup**: Pre-computed lowercase map (O(1))
- **Regex compilation**: Patterns compiled once at construction
- **Shallow cloning**: Event cloning via spread operator (fast)
- **Plain object detection**: Skips recursion for Date, Buffer, Error

## API Reference

### Factory Functions

#### createLogger(config: LoggerConfig): Logger

Generic logger factory accepting any profile.

```typescript
const logger = createLogger({
  service: "myapp",
  profile: LoggingProfile.STRUCTURED,
  filePath: "/var/log/app.log",
  middleware: [new RedactSecretsMiddleware()],
});
```

#### createSimpleLogger(service: string): Logger

Simple profile logger for CLI tools.

```typescript
const logger = createSimpleLogger("mycli");
```

#### createStructuredLogger(service: string, filePath?: string): Logger

Structured profile logger with optional file output.

```typescript
const logger = createStructuredLogger("api-server");
const fileLogger = createStructuredLogger("api-server", "/var/log/api.log");
```

#### createStructuredLoggerWithRedaction(service: string, options?): Logger

Structured logger with redaction middleware (secure by default).

**Options**:

- `filePath?: string` - File path for log output
- `customPatterns?: RegExp[]` - Additional regex patterns
- `customFields?: string[]` - Additional field names to redact
- `useDefaultPatterns?: boolean` - Include gofulmen defaults (default: `true`)

```typescript
const logger = createStructuredLoggerWithRedaction("api-server", {
  filePath: "/var/log/api.log",
  customPatterns: [/INTERNAL_ID_\d+/g],
  customFields: ["internalKey"],
});
```

#### createEnterpriseLogger(service: string, options?): Logger

Enterprise profile logger with custom sinks and middleware.

**Options**:

- `sinks?: Sink[]` - Custom log sinks
- `middleware?: Middleware[]` - Middleware pipeline

```typescript
const logger = createEnterpriseLogger("enterprise-app", {
  sinks: [new FileSink("/var/log/app.log")],
  middleware: [new RedactSecretsMiddleware()],
});
```

### Logger Methods

#### info(message: string, context?: LogContext): void

Log informational message.

```typescript
logger.info("User logged in", { userId: "user-123" });
```

#### warn(message: string, context?: LogContext): void

Log warning message.

```typescript
logger.warn("Rate limit approaching", { current: 950, max: 1000 });
```

#### error(message: string, context?: LogContext): void

Log error message.

```typescript
logger.error("Database connection failed", { error: "ECONNREFUSED" });
```

#### debug(message: string, context?: LogContext): void

Log debug message.

```typescript
logger.debug("Cache hit", { key: "user:123", ttl: 3600 });
```

#### child(bindings: LogContext): Logger

Create child logger with additional context.

```typescript
const requestLogger = logger.child({ requestId: "req-456" });
requestLogger.info("Processing request");
// Output includes: requestId in all log events
```

**Inheritance**:

- Child inherits parent's middleware chain
- Bindings are merged (child overrides parent on conflict)

### Middleware Classes

#### RedactSecretsMiddleware

**Constructor**:

```typescript
new RedactSecretsMiddleware(options?: {
  secretKeys?: string[];
  patterns?: RegExp[];
  useDefaultPatterns?: boolean;
})
```

**Default Options**:

- `secretKeys`: gofulmen-aligned field list
- `patterns`: gofulmen-aligned regex patterns
- `useDefaultPatterns`: `true`

#### AddFieldsMiddleware

**Constructor**:

```typescript
new AddFieldsMiddleware(fields: Record<string, unknown>)
```

**Example**:

```typescript
new AddFieldsMiddleware({
  environment: "production",
  region: "us-east-1",
});
```

#### TransformMiddleware

**Constructor**:

```typescript
new TransformMiddleware(transform: (event: LogEvent) => LogEvent)
```

**Example**:

```typescript
new TransformMiddleware((event) => ({
  ...event,
  message: event.message.toUpperCase(),
}));
```

### Sinks

#### FileSink

Write logs to file.

```typescript
new FileSink(filePath: string)
```

#### ConsoleSink

Write logs to console.

```typescript
new ConsoleSink();
```

#### NullSink

Discard logs (testing/benchmarking).

```typescript
new NullSink();
```

## Troubleshooting

### Secrets Not Being Redacted

**Problem**: Sensitive data appears in logs.

**Solutions**:

1. Verify field names match (case-insensitive): `password`, `token`, `apiKey`
2. Add custom field names: `customFields: ["mySecret"]`
3. Add custom patterns: `customPatterns: [/MY_SECRET_\d+/g]`
4. Check middleware is configured: `createStructuredLoggerWithRedaction()`

### Pattern Scanning Not Working on Large Strings

**Problem**: Patterns not redacting in large payloads.

**Cause**: 10KB threshold optimization skips pattern scanning.

**Solution**: Split large strings or use field-based redaction.

### Child Logger Not Inheriting Middleware

**Problem**: Child logger doesn't redact secrets.

**Cause**: Middleware misconfiguration.

**Solution**: Verify parent logger has middleware:

```typescript
const parent = createStructuredLoggerWithRedaction("api-server");
const child = parent.child({ requestId: "req-123" });
// ✅ Child inherits redaction middleware
```

### Performance Issues with Middleware

**Problem**: Logging slows down application.

**Cause**: Expensive middleware transforms.

**Solutions**:

1. Minimize middleware chain
2. Avoid complex regex patterns
3. Profile middleware with benchmarks
4. Use conditional middleware (only in production)

## Migration Guide

### From Simple to Structured

Before:

```typescript
const logger = createSimpleLogger("myapp");
```

After:

```typescript
const logger = createStructuredLogger("myapp");
```

### Adding Redaction to Existing Logger

Before:

```typescript
const logger = createStructuredLogger("api-server");
```

After:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server");
```

### From Manual Middleware to Helper

Before:

```typescript
const logger = createLogger({
  service: "api-server",
  profile: LoggingProfile.STRUCTURED,
  middleware: [new RedactSecretsMiddleware()],
});
```

After:

```typescript
const logger = createStructuredLoggerWithRedaction("api-server");
```

## See Also

- [Fulmen Helper Library Standard](https://github.com/fulmenhq/crucible/blob/main/docs/architecture/fulmen-helper-library-standard.md)
- [gofulmen Logging](https://github.com/fulmenhq/gofulmen) - Go reference implementation
- [Pino Documentation](https://getpino.io/) - Underlying logging library
- [TSFulmen Main README](../../README.md) - Project overview

---

**Version**: 0.1.11+
**Last Updated**: 2025-11-18
