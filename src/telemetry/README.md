# Telemetry & Metrics Export Module

Counter, gauge, and histogram metrics with OTLP-compatible export and taxonomy-backed validation for the Fulmen ecosystem.

## Features

- ✅ **Three Metric Types**: Counter, Gauge, Histogram
- ✅ **OTLP-Compatible**: OpenTelemetry Protocol histogram format
- ✅ **ADR-0007 Buckets**: Automatic default buckets for `_ms` metrics
- ✅ **Taxonomy Validation**: Metric names validated against taxonomy
- ✅ **Schema Validation**: Events validate against `metrics-event.schema.json`
- ✅ **Singleton Registry**: Module-level default instance
- ✅ **Type Safety**: Full TypeScript support with literal types

## Metric Types

| Type          | Use Case                      | Operations                     |
| ------------- | ----------------------------- | ------------------------------ |
| **Counter**   | Monotonic incrementing values | `inc(delta?)`                  |
| **Gauge**     | Arbitrary values (up or down) | `set(value)`, `inc()`, `dec()` |
| **Histogram** | Distribution of values        | `observe(value)`               |

## Quick Start

### Singleton Registry

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

// Counter: monotonic incrementing
metrics.counter("schema_validations").inc();
metrics.counter("config_load_errors").inc(2);

// Gauge: arbitrary values
metrics.gauge("foundry_lookup_count").set(42);
metrics.gauge("foundry_lookup_count").inc(10);

// Histogram: distribution with automatic bucketing
const startTime = performance.now();
await loadConfig();
metrics.histogram("config_load_ms").observe(performance.now() - startTime);

// Export all metrics
const events = await metrics.export();
console.log(JSON.stringify(events, null, 2));

// Flush: export and clear
await metrics.flush({
  emit: (events) => logger.info({ metrics: events }),
});
```

### Custom Registry

```typescript
import { MetricsRegistry } from "@fulmenhq/tsfulmen/telemetry";

const registry = new MetricsRegistry();

// Use like singleton
const counter = registry.counter("operations");
counter.inc();

const events = await registry.export();
```

## API Reference

### Singleton Registry

#### `metrics.counter(name): Counter`

Get or create a counter.

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

const counter = metrics.counter("schema_validations");
counter.inc(); // Increment by 1
counter.inc(5); // Increment by 5
```

#### `metrics.gauge(name): Gauge`

Get or create a gauge.

```typescript
const gauge = metrics.gauge("foundry_lookup_count");
gauge.set(42); // Set to specific value
gauge.inc(); // Increment by 1
gauge.dec(5); // Decrement by 5
```

#### `metrics.histogram(name, options?): Histogram`

Get or create a histogram with optional custom buckets.

```typescript
// Automatic ADR-0007 buckets for _ms metrics
const histogram = metrics.histogram("config_load_ms");
histogram.observe(125.5);

// Custom buckets
const custom = metrics.histogram("custom_metric", {
  buckets: [10, 50, 100, 500, 1000],
});
custom.observe(75);
```

#### `metrics.export(): Promise<MetricsEvent[]>`

Export all metrics as schema-compliant events (does not clear).

```typescript
const events = await metrics.export();

for (const event of events) {
  console.log(`${event.name}: ${event.value}`);
}
```

#### `metrics.flush(options?): Promise<MetricsEvent[]>`

Export metrics, optionally emit via callback, then clear all metrics.

```typescript
// Export and clear
const events = await metrics.flush();

// Export, emit to logger, then clear
await metrics.flush({
  emit: (events) => {
    for (const event of events) {
      logger.info({ metric: event });
    }
  },
});
```

### Counter

#### `counter.inc(delta?: number): void`

Increment counter. Rejects negative deltas.

```typescript
const counter = metrics.counter("requests");

counter.inc(); // +1
counter.inc(5); // +5
counter.inc(-1); // ❌ Throws error
```

#### `counter.getValue(): number`

Get current value.

```typescript
const value = counter.getValue(); // e.g., 42
```

#### `counter.reset(): void`

Reset to zero.

```typescript
counter.reset();
console.log(counter.getValue()); // 0
```

### Gauge

#### `gauge.set(value: number): void`

Set gauge to specific value (can be negative).

```typescript
const gauge = metrics.gauge("temperature_celsius");

gauge.set(25.5);
gauge.set(-10); // ✅ Negative values allowed
```

#### `gauge.inc(delta?: number): void`

Increment gauge (default: 1).

```typescript
gauge.inc(); // +1
gauge.inc(10); // +10
gauge.inc(-5); // -5 (decrements by 5)
```

#### `gauge.dec(delta?: number): void`

Decrement gauge (default: 1).

```typescript
gauge.dec(); // -1
gauge.dec(10); // -10
gauge.dec(-5); // +5 (increments by 5)
```

#### `gauge.getValue(): number`

Get current value.

```typescript
const value = gauge.getValue();
```

#### `gauge.reset(): void`

Reset to zero.

```typescript
gauge.reset();
```

### Histogram

#### `histogram.observe(value: number): void`

Record observation.

```typescript
const histogram = metrics.histogram("request_duration_ms");

histogram.observe(125.5);
histogram.observe(89.2);
histogram.observe(1500);
```

#### `histogram.getSummary(): HistogramSummary`

Get histogram summary with OTLP-compatible cumulative buckets.

```typescript
const summary = histogram.getSummary();

console.log(summary.count); // Total observations
console.log(summary.sum); // Sum of all values
console.log(summary.buckets); // Cumulative bucket counts

// Bucket format:
// [
//   { le: 10, count: 3 },    // 3 observations <= 10
//   { le: 50, count: 7 },    // 7 observations <= 50 (cumulative)
//   { le: 100, count: 15 }   // 15 observations <= 100 (cumulative)
// ]
```

#### `histogram.reset(): void`

Reset histogram to initial state.

```typescript
histogram.reset();
```

## ADR-0007 Default Buckets

Metrics ending with `_ms` automatically apply default histogram buckets:

```typescript
const histogram = metrics.histogram("config_load_ms");

// Automatic buckets: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000]
histogram.observe(125);
```

**Override with custom buckets:**

```typescript
const histogram = metrics.histogram("config_load_ms", {
  buckets: [10, 100, 1000], // Custom buckets
});
```

## Taxonomy-Backed Metrics

All metric names are validated against `config/crucible-ts/taxonomy/metrics.yaml`:

### Available Metrics

| Metric Name                    | Unit  | Type      | Purpose                       |
| ------------------------------ | ----- | --------- | ----------------------------- |
| `schema_validations`           | count | Counter   | Schema validation operations  |
| `schema_validation_errors`     | count | Counter   | Schema validation failures    |
| `config_load_ms`               | ms    | Histogram | Config loading time           |
| `config_load_errors`           | count | Counter   | Config loading failures       |
| `pathfinder_find_ms`           | ms    | Histogram | Path finding duration         |
| `pathfinder_validation_errors` | count | Counter   | Pathfinder validation errors  |
| `pathfinder_security_warnings` | count | Counter   | Pathfinder security warnings  |
| `foundry_lookup_count`         | count | Gauge     | Foundry catalog lookups       |
| `logging_emit_count`           | count | Counter   | Log messages emitted          |
| `logging_emit_latency_ms`      | ms    | Histogram | Log emission latency          |
| `goneat_command_duration_ms`   | ms    | Histogram | Goneat command execution time |

### Type Guards

```typescript
import {
  isValidMetricName,
  isValidMetricUnit,
} from "@fulmenhq/tsfulmen/telemetry";

if (isValidMetricName("schema_validations")) {
  // Valid metric name from taxonomy
}

if (isValidMetricUnit("ms")) {
  // Valid unit
}
```

## Metrics Event Format

### Counter/Gauge Event

```json
{
  "timestamp": "2025-10-24T16:00:00.000Z",
  "name": "schema_validations",
  "value": 42,
  "unit": "count",
  "tags": {
    "environment": "production"
  }
}
```

### Histogram Event

```json
{
  "timestamp": "2025-10-24T16:00:00.000Z",
  "name": "config_load_ms",
  "value": {
    "count": 10,
    "sum": 523.5,
    "buckets": [
      { "le": 1, "count": 0 },
      { "le": 5, "count": 1 },
      { "le": 10, "count": 3 },
      { "le": 50, "count": 7 },
      { "le": 100, "count": 9 },
      { "le": 500, "count": 9 },
      { "le": 1000, "count": 10 },
      { "le": 5000, "count": 10 },
      { "le": 10000, "count": 10 }
    ]
  },
  "unit": "ms"
}
```

**Note**: Histogram buckets use **cumulative counts** (OTLP-compatible):

- Each bucket's count includes all observations <= that boundary
- Example: If `le: 50` has `count: 7`, then 7 total observations were <= 50ms

## Schema Validation

### Validate Events

```typescript
import {
  validateMetricsEvent,
  assertValidMetricsEvent,
} from "@fulmenhq/tsfulmen/telemetry";

const event = {
  timestamp: new Date().toISOString(),
  name: "schema_validations",
  value: 42,
  unit: "count",
};

// Check validity
if (await validateMetricsEvent(event)) {
  console.log("Valid event");
}

// Assert validity (throws if invalid)
await assertValidMetricsEvent(event);
```

### Get Validation Errors

```typescript
import {
  validateMetricsEvent,
  getValidationErrors,
  formatValidationErrors,
} from "@fulmenhq/tsfulmen/telemetry";

const isValid = await validateMetricsEvent(invalidEvent);

if (!isValid) {
  const errors = getValidationErrors();
  if (errors) {
    console.error(formatValidationErrors(errors));
  }
}
```

## Registry Management

### Clear Metrics

```typescript
// Reset all metrics to zero (without exporting)
metrics.clear();
```

### Get Metric Names

```typescript
const names = metrics.getMetricNames();
console.log(names); // ['schema_validations', 'config_load_ms', ...]
```

### Get Metric Count

```typescript
const count = metrics.getMetricCount();
console.log(`Tracking ${count} metrics`);
```

## Integration Patterns

### With Error Handling

```typescript
import { FulmenError } from "@fulmenhq/tsfulmen/errors";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

async function loadConfig(path: string) {
  const startTime = performance.now();

  try {
    const config = await readConfig(path);
    metrics.histogram("config_load_ms").observe(performance.now() - startTime);
    return config;
  } catch (err) {
    metrics.counter("config_load_errors").inc();
    metrics.histogram("config_load_ms").observe(performance.now() - startTime);

    throw FulmenError.fromError(err, {
      code: "CONFIG_LOAD_FAILED",
      severity: "high",
      context: { path },
    });
  }
}
```

### With Logging

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";
import { logger } from "./logger";

// Periodic metrics flush
setInterval(async () => {
  await metrics.flush({
    emit: (events) => {
      logger.info({
        message: "Metrics snapshot",
        metrics: events,
      });
    },
  });
}, 60000); // Every minute
```

### With Schema Validation

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";
import { validateData } from "@fulmenhq/tsfulmen/schema";

async function validateWithMetrics(schema: string, data: unknown) {
  metrics.counter("schema_validations").inc();

  try {
    const result = await validateData(schema, data);
    if (!result.valid) {
      metrics.counter("schema_validation_errors").inc();
    }
    return result;
  } catch (err) {
    metrics.counter("schema_validation_errors").inc();
    throw err;
  }
}
```

## Performance Tracking

### Operation Duration

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

async function timedOperation<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await operation();
    metrics.histogram(`${name}_ms`).observe(performance.now() - startTime);
    return result;
  } catch (err) {
    metrics.counter(`${name}_errors`).inc();
    metrics.histogram(`${name}_ms`).observe(performance.now() - startTime);
    throw err;
  }
}

// Usage
await timedOperation("config_load", () => loadConfig("/path/to/config"));
```

### Rate Tracking

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

class RateLimiter {
  track(operation: string) {
    metrics.counter(`${operation}_attempts`).inc();
  }

  reject(operation: string) {
    metrics.counter(`${operation}_rejected`).inc();
  }
}
```

## Testing

```bash
# Run all telemetry tests
bunx vitest run src/telemetry/__tests__/

# Run specific test suites
bunx vitest run src/telemetry/__tests__/counter.test.ts    # Counter tests
bunx vitest run src/telemetry/__tests__/gauge.test.ts      # Gauge tests
bunx vitest run src/telemetry/__tests__/histogram.test.ts  # Histogram tests
bunx vitest run src/telemetry/__tests__/registry.test.ts   # Registry tests
bunx vitest run src/telemetry/__tests__/taxonomy.test.ts   # Taxonomy tests
bunx vitest run src/telemetry/__tests__/types.test.ts      # Type guards
```

## Cross-Language Compatibility

Telemetry module maintains API parity with:

- **pyfulmen** (Python): Same metric types and export format
- **gofulmen** (Go): Compatible registry and OTLP format

All implementations share:

- Same ADR-0007 histogram buckets
- Same OTLP-compatible export format
- Same taxonomy (`config/crucible-ts/taxonomy/metrics.yaml`)
- Compatible test fixtures in `tests/fixtures/metrics/`

## Documentation

- **Standard**: [Telemetry & Metrics](../../docs/crucible-ts/standards/library/modules/telemetry-metrics.md)
- **ADR-0007**: Histogram Default Buckets
- **Schema**: `schemas/crucible-ts/observability/metrics/v1.0.0/metrics-event.schema.json`
- **Taxonomy**: `config/crucible-ts/taxonomy/metrics.yaml`
- **Fixtures**: `tests/fixtures/metrics/`

## Implementation Status

- ✅ Counter implementation (8 tests)
- ✅ Gauge implementation (12 tests)
- ✅ Histogram with ADR-0007 buckets (14 tests)
- ✅ Registry management (14 tests)
- ✅ Taxonomy loader (19 tests)
- ✅ Type guards (18 tests)
- ✅ Validators (22 tests, 16 pending taxonomy YAML reference support)

**Total**: 85 tests passing (107 with validators)

## Known Limitations

- **Validator tests**: 16 tests currently fail due to schema loader limitation with YAML taxonomy references. Awaiting Schema Cartographer enhancement.
- **Workaround**: Use type guards (`isValidMetricName`) for runtime validation.

## See Also

- [Error Handling Module](../errors/README.md)
- [Logging Module](../logging/README.md)
- [Schema Validation](../schema/README.md)
- [Example Script](../../examples/error-telemetry-demo.ts)
