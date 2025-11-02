# Pathfinder Observability Options

Pathfinder exposes instrumentation hooks through the optional `PathfinderOptions`
parameter on the constructor:

```ts
import { Pathfinder } from "@fulmenhq/tsfulmen/pathfinder";
import { Logger } from "@fulmenhq/tsfulmen/logging";
import { metrics as sharedMetrics } from "@fulmenhq/tsfulmen/telemetry";

const logger = new Logger({
  service: "example",
  profile: LoggingProfile.SIMPLE,
});

const finder = new Pathfinder(
  {
    // Standard PathfinderConfig fields (include/exclude, constraints, checksums, etc.)
    calculateChecksums: true,
  },
  {
    logger,
    metrics: sharedMetrics,
    correlationId: "my-correlation-id",
  },
);
```

`PathfinderOptions` fields:

- `logger?: Logger` – Enables structured logging for traversal lifecycle events. When provided,
  Pathfinder will annotate every log entry with the shared `correlation_id` and the
  `pathfinder` domain tag. WARN-mode constraint violations and checksum failures emit `warn`
  level entries so downstream systems can track recoverable issues without forcing the caller
  to wire custom callbacks.
- `metrics?: MetricsRegistry` – Overrides the metrics sink used for telemetry. By default
  Pathfinder uses the shared singleton from `@fulmenhq/tsfulmen/telemetry`. Supplying a custom
  registry lets hosts sandbox observations (for example in tests) while maintaining the same
  metric names: `pathfinder_find_ms` for traversal latency and `pathfinder_security_warnings`
  for constraint violations.
- `correlationId?: string` – Propagates a caller-specified correlation identifier through all
  errors and log lines. If omitted, Pathfinder generates a UUID via `generateCorrelationId()`.

## Checksum failure semantics

When `calculateChecksums` is enabled and a checksum attempt fails (for example due to a read or
permission error), Pathfinder:

1. Records metadata with both `checksumAlgorithm` and a placeholder checksum (`algorithm:error`)
   so consumers can detect failures without inspecting logs.
2. Emits a `warn` log entry (when a logger is provided) containing `path`, `resolvedPath`,
   `algorithm`, and the captured error message. This mirrors the metadata payload and improves
   traceability in structured logging pipelines.

These behaviours are non-fatal: traversal continues unless STRICT constraint enforcement triggers
an error. Callers that need to surface checksum failures can either inspect the returned metadata
or subscribe to the `errorCallback` option in `PathfinderExecuteOptions`.
