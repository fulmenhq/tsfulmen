# Prometheus Exporter

First-party Prometheus bridge for TSFulmen's telemetry registry. Converts counters, gauges, and histograms to Prometheus text exposition format using `prom-client`.

## Features

- ✅ **Automatic Metric Conversion** - Bridges TSFulmen TelemetryRegistry to Prometheus collectors
- ✅ **Framework Agnostic** - Works with Express, Fastify, native Node.js http, and more
- ✅ **Background Refresh** - Optional automatic registry synchronization
- ✅ **Lifecycle Integration** - Graceful shutdown with signal handling
- ✅ **App Identity Support** - Auto-detects namespace/subsystem from `.fulmen/app.yaml`
- ✅ **CLI Tools** - Serve, validate, and export commands for development

## Installation

```bash
# Install TSFulmen (if not already installed)
bun add @fulmenhq/tsfulmen

# Install prom-client peer dependency
bun add prom-client
```

**Note**: `prom-client` is an optional peer dependency. Install it explicitly to enable Prometheus export functionality.

## Quick Start

### Basic Usage

```typescript
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

// Create exporter
const exporter = new PrometheusExporter({ registry: metrics });

// Refresh metrics from registry
await exporter.refresh();

// Get Prometheus text format
const output = await exporter.getMetrics();
console.log(output);
```

### HTTP Server (Express)

```typescript
import express from "express";
import {
  PrometheusExporter,
  createMetricsHandler,
} from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

const app = express();
const exporter = new PrometheusExporter({ registry: metrics });

// Serve metrics at /metrics endpoint
app.get("/metrics", createMetricsHandler(exporter));

app.listen(3000);
```

### Dev Server (Standalone)

```typescript
import {
  PrometheusExporter,
  startMetricsServer,
} from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

const exporter = new PrometheusExporter({ registry: metrics });

// Start background refresh
exporter.startRefresh({ intervalMs: 15000 });

// Start metrics server
const server = await startMetricsServer(exporter, {
  host: "127.0.0.1",
  port: 9464,
  path: "/metrics",
});

console.log("Metrics server running on http://127.0.0.1:9464/metrics");
```

## Configuration

### Exporter Options

```typescript
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

const exporter = new PrometheusExporter({
  // TelemetryRegistry instance (defaults to global metrics singleton)
  registry: metrics,

  // Namespace for metrics (defaults to App Identity vendor or 'tsfulmen')
  namespace: "mycompany",

  // Subsystem for metrics (defaults to App Identity binary_name or 'app')
  subsystem: "myapp",

  // Default labels applied to all metrics
  defaultLabels: {
    environment: "production",
    version: "1.0.0",
  },

  // Custom help text for metrics
  helpText: {
    http_requests: "Total HTTP requests received",
    database_queries: "Database queries executed",
  },

  // Metrics configuration flags
  metricsEnabled: true, // Enable/disable metrics collection
  recordClientLabel: true, // Include client IP in metrics labels
  moduleMetricsEnabled: true, // Enable per-module metrics breakdown
});
```

### Metrics Configuration Flags

#### `metricsEnabled: boolean`

Controls whether metrics are collected and exported. When disabled, the exporter remains functional but no metrics are generated.

```typescript
// Disable metrics (useful for testing or debugging)
const exporter = new PrometheusExporter({
  registry: metrics,
  metricsEnabled: false,
});

// Check current configuration
const config = exporter.getMetricsConfig();
console.log(config.metricsEnabled); // false
```

#### `recordClientLabel: boolean`

When enabled, automatically adds the client IP address as a label to metrics. Useful for identifying traffic sources but may increase cardinality.

```typescript
// Disable client IP recording to reduce cardinality
const exporter = new PrometheusExporter({
  registry: metrics,
  recordClientLabel: false,
});
```

#### `moduleMetricsEnabled: boolean`

Controls whether metrics are broken down by module. When enabled, metrics include module-specific labels for granular monitoring.

```typescript
// Disable module breakdown for simpler metrics
const exporter = new PrometheusExporter({
  registry: metrics,
  moduleMetricsEnabled: false,
});
```

### Metric Naming

Metrics follow Prometheus naming conventions:

```
{namespace}_{subsystem}_{metric_name}
```

**Examples**:

- `tsfulmen_app_schema_validations` (default)
- `mycompany_myapp_http_requests` (with custom namespace/subsystem)

### App Identity Integration

If `.fulmen/app.yaml` exists, the exporter automatically uses:

- `namespace` → `app.vendor`
- `subsystem` → `app.binary_name`

Override via constructor options if needed.

## Framework Integration

### Express

```typescript
import express from "express";
import {
  PrometheusExporter,
  createMetricsHandler,
} from "@fulmenhq/tsfulmen/telemetry/prometheus";

const app = express();
const exporter = new PrometheusExporter();

// Basic metrics endpoint
app.get("/metrics", createMetricsHandler(exporter));

// With refresh-on-scrape
app.get(
  "/metrics",
  createMetricsHandler(exporter, {
    refreshOnScrape: true, // Refresh before each scrape (adds latency)
  }),
);

app.listen(3000);
```

### Fastify

```typescript
import Fastify from "fastify";
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";

const fastify = Fastify();
const exporter = new PrometheusExporter();

fastify.get("/metrics", async (request, reply) => {
  await exporter.refresh();
  const metrics = await exporter.getMetrics();

  reply
    .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
    .send(metrics);
});

await fastify.listen({ port: 3000 });
```

### Node.js HTTP

```typescript
import { createServer } from "node:http";
import {
  PrometheusExporter,
  createMetricsHandler,
} from "@fulmenhq/tsfulmen/telemetry/prometheus";

const exporter = new PrometheusExporter();
const handler = createMetricsHandler(exporter);

const server = createServer(handler);
server.listen(9464);
```

## Authentication & Rate Limiting

### Bearer Token Authentication

```typescript
import { createMetricsHandler } from "@fulmenhq/tsfulmen/telemetry/prometheus";

const handler = createMetricsHandler(exporter, {
  authenticate: async (req) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.toString().replace("Bearer ", "");
    return token === process.env.METRICS_TOKEN;
  },
});
```

### Rate Limiting

```typescript
import { createMetricsHandler } from "@fulmenhq/tsfulmen/telemetry/prometheus";

// Simple IP-based rate limiter
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

const handler = createMetricsHandler(exporter, {
  rateLimit: async (req) => {
    const ip = req.remoteAddress || "unknown";
    const now = Date.now();
    const limit = 60; // requests per minute

    const entry = rateLimitCache.get(ip);
    if (!entry || entry.resetAt < now) {
      rateLimitCache.set(ip, { count: 1, resetAt: now + 60000 });
      return true;
    }

    if (entry.count >= limit) {
      return false; // Rate limit exceeded
    }

    entry.count++;
    return true;
  },
});
```

### Combined Auth + Rate Limiting

```typescript
const handler = createMetricsHandler(exporter, {
  authenticate: async (req) => {
    // Check authentication first
    const token = req.headers["authorization"]?.toString();
    return token === process.env.METRICS_TOKEN;
  },
  rateLimit: async (req) => {
    // Then check rate limits
    return checkRateLimit(req.remoteAddress);
  },
});
```

## Background Refresh

### Manual Refresh

```typescript
const exporter = new PrometheusExporter();

// Refresh once
await exporter.refresh();

// Get metrics
const output = await exporter.getMetrics();
```

### Automatic Background Refresh

```typescript
const exporter = new PrometheusExporter();

// Start background refresh (15 second interval)
exporter.startRefresh();

// Custom interval and error handling
exporter.startRefresh({
  intervalMs: 10000,
  onError: (err) => {
    console.error("Refresh failed:", err);
  },
});

// Stop background refresh (performs final refresh)
await exporter.stopRefresh();
```

### Lifecycle Integration

```typescript
import {
  PrometheusExporter,
  registerPrometheusShutdown,
} from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { createSignalManager } from "@fulmenhq/tsfulmen/foundry/signals";

const exporter = new PrometheusExporter();
const signalManager = createSignalManager();

// Register shutdown handlers for SIGTERM/SIGINT
await registerPrometheusShutdown(exporter, signalManager);

// Start background refresh
exporter.startRefresh({ intervalMs: 15000 });

// On shutdown: stopRefresh() called automatically with final metrics sync
```

### Configuration Introspection

```typescript
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";

const exporter = new PrometheusExporter({
  metricsEnabled: true,
  recordClientLabel: false,
  moduleMetricsEnabled: true,
});

// Get current configuration
const config = exporter.getMetricsConfig();
console.log("Metrics enabled:", config.metricsEnabled);
console.log("Client labels:", config.recordClientLabel);
console.log("Module metrics:", config.moduleMetricsEnabled);

// Runtime configuration changes (if needed)
exporter.options.metricsEnabled = false;
const updatedConfig = exporter.getMetricsConfig();
console.log("Updated:", updatedConfig.metricsEnabled); // false
```

## CLI Commands

### Serve Metrics (Dev Server)

```bash
# Start metrics server on default port (9464)
bunx tsx src/telemetry/prometheus/cli.ts serve

# Custom configuration
bunx tsx src/telemetry/prometheus/cli.ts serve \
  --host 0.0.0.0 \
  --port 9090 \
  --path /prometheus/metrics \
  --interval 10000
```

### Export Metrics (One-Shot)

```bash
# Export to stdout (text format)
bunx tsx src/telemetry/prometheus/cli.ts export

# Export to file
bunx tsx src/telemetry/prometheus/cli.ts export --out metrics.txt

# JSON format
bunx tsx src/telemetry/prometheus/cli.ts export --format json --out metrics.json
```

### Validate Installation

```bash
# Check prom-client availability and configuration
bunx tsx src/telemetry/prometheus/cli.ts validate

# Verbose output with diagnostics
bunx tsx src/telemetry/prometheus/cli.ts validate --verbose
```

## Error Handling

### Missing Peer Dependency

```typescript
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";

try {
  const exporter = new PrometheusExporter();
  await exporter.refresh();
} catch (err) {
  if (err.code === "PROM_CLIENT_NOT_FOUND") {
    console.error("prom-client not installed. Run: bun add prom-client");
  }
}
```

### Invalid Metric Names

```typescript
import { PrometheusExporter } from "@fulmenhq/tsfulmen/telemetry/prometheus";
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

// Invalid metric name (starts with number)
metrics.counter("123_invalid").inc();

const exporter = new PrometheusExporter({ registry: metrics });

try {
  await exporter.refresh();
} catch (err) {
  if (err.code === "INVALID_METRIC_NAME") {
    console.error("Invalid metric name:", err.message);
    // Suggests: Use 'metric_123_invalid' instead
  }
}
```

### Refresh Errors

```typescript
exporter.startRefresh({
  intervalMs: 15000,
  onError: (err) => {
    // Log refresh errors without stopping the loop
    logger.error("Prometheus refresh failed:", { error: err.message });
  },
});
```

## Statistics

```typescript
const exporter = new PrometheusExporter();
await exporter.refresh();

const stats = exporter.getStats();
console.log(stats);
// {
//   refreshCount: 5,
//   errorCount: 0,
//   lastRefreshTime: '2025-11-06T12:34:56.789Z',
//   isRefreshing: false,
//   counters: 12,
//   gauges: 8,
//   histograms: 3
// }
```

## Metric Types

### Counters

Monotonically increasing values (requests, errors, etc.):

```typescript
import { metrics } from "@fulmenhq/tsfulmen/telemetry";

metrics.counter("http_requests").inc();
metrics.counter("http_errors", { code: "500" }).inc(3);
```

### Gauges

Arbitrary values that can go up or down (connections, queue size):

```typescript
metrics.gauge("active_connections").set(42);
metrics.gauge("queue_size", { queue: "emails" }).set(128);
```

### Histograms

Distribution of values (latencies, sizes):

```typescript
const startTime = performance.now();
await processRequest();
const duration = performance.now() - startTime;

metrics.histogram("request_duration_ms").observe(duration);
```

## Troubleshooting

### Metrics Not Appearing

1. **Check prom-client installation**:

   ```bash
   bun pm ls | grep prom-client
   ```

2. **Verify refresh is called**:

   ```typescript
   await exporter.refresh(); // Must be called before getMetrics()
   ```

3. **Check registry has metrics**:
   ```typescript
   const events = await metrics.export();
   console.log("Metric count:", events.length);
   ```

### Performance Issues

1. **Use background refresh instead of refresh-on-scrape**:

   ```typescript
   // Bad: Adds latency to every scrape
   createMetricsHandler(exporter, { refreshOnScrape: true });

   // Good: Refresh asynchronously in background
   exporter.startRefresh({ intervalMs: 15000 });
   createMetricsHandler(exporter, { refreshOnScrape: false });
   ```

2. **Adjust refresh interval**:

   ```typescript
   // High-frequency metrics: shorter interval
   exporter.startRefresh({ intervalMs: 5000 });

   // Low-frequency metrics: longer interval
   exporter.startRefresh({ intervalMs: 60000 });
   ```

### Memory Leaks

1. **Always stop refresh on shutdown**:

   ```typescript
   process.on("SIGTERM", async () => {
     await exporter.stopRefresh();
     server.close();
   });
   ```

2. **Use lifecycle integration**:

   ```typescript
   import { registerPrometheusShutdown } from "@fulmenhq/tsfulmen/telemetry/prometheus";
   import { createSignalManager } from "@fulmenhq/tsfulmen/foundry/signals";

   const signalManager = createSignalManager();
   await registerPrometheusShutdown(exporter, signalManager);
   ```

## Examples

See working examples in the TSFulmen repository:

- **Basic Export**: `examples/prometheus-basic.ts`
- **Express Integration**: `examples/prometheus-express.ts`
- **Background Refresh**: `examples/prometheus-refresh.ts`
- **CLI Usage**: `examples/prometheus-cli.sh`

## API Reference

### PrometheusExporter

- `constructor(options?: PrometheusExporterOptions)` - Create exporter
- `refresh(): Promise<void>` - Sync metrics from registry
- `getMetrics(): Promise<string>` - Get Prometheus text format
- `getMetricsJSON(): Promise<object[]>` - Get JSON format
- `startRefresh(options?: RefreshOptions): void` - Start background refresh
- `stopRefresh(): Promise<void>` - Stop background refresh (with final sync)
- `getStats(): ExporterStats` - Get exporter statistics
- `getMetricsConfig(): MetricsConfig` - Get current metrics configuration

### Functions

- `createMetricsHandler(exporter, options?)` - Create HTTP handler
- `startMetricsServer(exporter, options?)` - Start dev server
- `stopMetricsServer(server, timeoutMs?)` - Stop dev server
- `registerPrometheusShutdown(exporter, signalManager)` - Register shutdown hooks

### Types

- `PrometheusExporterOptions` - Exporter configuration
- `RefreshOptions` - Background refresh configuration
- `ServerOptions` - HTTP server configuration
- `ExporterStats` - Exporter statistics
- `MetricsConfig` - Current metrics configuration

## License

Part of TSFulmen - MIT License

---

**Note**: This module requires `prom-client` as a peer dependency. Install with `bun add prom-client` or `npm install prom-client`.
