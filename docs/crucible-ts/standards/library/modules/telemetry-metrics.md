---
title: "Telemetry & Metrics Export"
description: "Lightweight counter and histogram export aligned with the observability logging pipeline."
status: "draft"
last_updated: "2025-10-18"
tags: ["standards", "library", "observability", "metrics"]
---

# Telemetry & Metrics Export

## Overview

This extension module adds a minimal metrics surface to Fulmen helper libraries so that critical paths can be
instrumented from day zero. Events are emitted as JSON (stdout or structured logs) and validated against
`schemas/observability/metrics/v1.0.0/metrics-event.schema.json`, which in turn references the shared
metrics taxonomy (`config/taxonomy/metrics.yaml`).

## Principles

- **Taxonomy-Backed Identifiers** – Metric names/units come from the taxonomy file; libraries MUST not invent
  ad-hoc identifiers without upstreaming them into Crucible.
- **Scalar or Histogram** – `value` MAY be a scalar number (counter/gauge) or a histogram summary object with
  OTLP-style buckets (`{count,sum,buckets[]}`).
- **JSON-First Export** – Metrics are serialised to JSON for pipelines/agents; libraries may adapt the data to
  other sinks but the canonical format is JSON.
- **No External Dependencies** – Implementations use standard library data structures and ship offline.
- **Optional Adoption** – Module is recommended (extension tier) but not mandatory; coverage targets set
  expectations per language.

## API Surface

- `metrics.counter(name).inc(delta?)`
- `metrics.gauge(name).set(value)`
- `metrics.histogram(name).observe(value)`
- `metrics.export()` → array of schema-compliant events
- `metrics.flush()` → emit & clear events, optionally publishing through the logging pipeline

## Language Examples

**Go**

```go
metrics.Counter("schema_validations").Inc()
metrics.Histogram("config_load_ms").Observe(42)
if err := telemetry.Validate(metrics.Export()); err != nil {
    log.Fatal(err)
}
metrics.Flush()
```

**TypeScript**

```typescript
metrics.counter("schema_validations").inc();
metrics.histogram("config_load_ms").observe(42);
assert(validateMetrics(metrics.export()), "invalid payload");
metrics.flush();
```

**Python**

```python
metrics.counter("schema_validations").inc()
metrics.histogram("config_load_ms").observe(42)
assert validate_metrics(metrics.export())
metrics.flush()
```

## Testing Expectations

- **Coverage**: ≥85 % covering counters, gauges, histograms, tags, and flush behaviour.
- **Fixtures**: `tests/fixtures/metrics/` should include scalar and histogram examples plus failure cases (unknown
  metric, invalid buckets).
- **Integration**: Validate alongside logging middleware (metrics events can be appended to log payloads) and
  schema validation flows.
- **Tooling**: goneat `schema validate` using the updated metrics schema and taxonomy definitions.

## Ecosystem Ties

- **Logging**: Metrics events may be embedded inside progressive logging payloads for SIMPLE/STRUCTURED profiles.
- **Assessment**: Future goneat assess categories can rely on the taxonomy to audit mandatory metrics.
- **Extensibility**: New metrics are proposed via Crucible PRs updating `config/taxonomy/metrics.yaml` so all
  languages stay in sync.
