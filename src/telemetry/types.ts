/**
 * Telemetry types - TypeScript types for metrics events
 *
 * Based on schemas/crucible-ts/observability/metrics/v1.0.0/metrics-event.schema.json
 * and config/crucible-ts/taxonomy/metrics.yaml
 */

/**
 * Metric name from taxonomy
 * Aligned with config/crucible-ts/taxonomy/metrics.yaml#/$defs/metricName
 * Updated for Crucible v0.2.7 (Prometheus exporter + module metrics)
 */
export type MetricName =
  // Existing metrics
  | "schema_validations"
  | "schema_validation_errors"
  | "config_load_ms"
  | "config_load_errors"
  | "pathfinder_find_ms"
  | "pathfinder_validation_errors"
  | "pathfinder_security_warnings"
  | "foundry_lookup_count"
  | "logging_emit_count"
  | "logging_emit_latency_ms"
  | "goneat_command_duration_ms"
  // Prometheus exporter metrics (v0.2.7)
  | "prometheus_exporter_refresh_duration_seconds"
  | "prometheus_exporter_refresh_total"
  | "prometheus_exporter_refresh_errors_total"
  | "prometheus_exporter_refresh_inflight"
  | "prometheus_exporter_http_requests_total"
  | "prometheus_exporter_http_errors_total"
  | "prometheus_exporter_restarts_total"
  // Foundry MIME detection metrics (v0.2.7)
  | "foundry_mime_detections_total_json"
  | "foundry_mime_detections_total_xml"
  | "foundry_mime_detections_total_yaml"
  | "foundry_mime_detections_total_csv"
  | "foundry_mime_detections_total_plain_text"
  | "foundry_mime_detections_total_unknown"
  | "foundry_mime_detection_ms_json"
  | "foundry_mime_detection_ms_xml"
  | "foundry_mime_detection_ms_yaml"
  | "foundry_mime_detection_ms_csv"
  | "foundry_mime_detection_ms_plain_text"
  | "foundry_mime_detection_ms_unknown"
  // Error handling metrics (v0.2.7)
  | "error_handling_wraps_total"
  | "error_handling_wrap_ms"
  // FulHash metrics (v0.2.7)
  | "fulhash_operations_total_xxh3_128"
  | "fulhash_operations_total_sha256"
  | "fulhash_hash_string_total"
  | "fulhash_bytes_hashed_total"
  | "fulhash_operation_ms";

/**
 * Metric unit from taxonomy
 * Aligned with config/crucible-ts/taxonomy/metrics.yaml#/$defs/metricUnit
 * Updated for Crucible v0.2.7 (adds 's' for seconds)
 */
export type MetricUnit = "count" | "ms" | "bytes" | "percent" | "s";

/**
 * Histogram bucket for OTLP-compatible histograms
 */
export interface HistogramBucket {
  /** Upper bound (less-than-or-equal) for the bucket */
  le: number;
  /** Cumulative count up to and including this bucket */
  count: number;
}

/**
 * Histogram summary payload
 */
export interface HistogramSummary {
  /** Total count of observations */
  count: number;
  /** Sum of all observed values */
  sum: number;
  /** Ordered buckets with cumulative counts (OTLP-compatible) */
  buckets: HistogramBucket[];
}

/**
 * Metric value (scalar or histogram)
 */
export type MetricValue = number | HistogramSummary;

/**
 * Metrics event structure
 * Aligned with schemas/crucible-ts/observability/metrics/v1.0.0/metrics-event.schema.json
 */
export interface MetricsEvent {
  /** RFC3339 timestamp of metric emission */
  timestamp: string;
  /** Metric identifier from taxonomy */
  name: MetricName;
  /** Measurement payload (scalar or histogram summary) */
  value: MetricValue;
  /** Optional key/value dimensions */
  tags?: Record<string, string>;
  /** Optional metric unit (defaults to taxonomy default) */
  unit?: MetricUnit;
}

/**
 * Histogram options for customization
 */
export interface HistogramOptions {
  /** Custom bucket boundaries (overrides default ADR-0007 buckets) */
  buckets?: number[];
}

/**
 * Flush options for metrics registry
 */
export interface FlushOptions {
  /** Optional logger function to emit metrics */
  emit?: (events: MetricsEvent[]) => void;
}

/**
 * Type guard to check if value is a histogram summary
 */
export function isHistogramSummary(value: unknown): value is HistogramSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "count" in value &&
    "sum" in value &&
    "buckets" in value
  );
}

/**
 * Type guard to check if metric name is valid
 */
export function isValidMetricName(name: string): name is MetricName {
  const validNames: MetricName[] = [
    "schema_validations",
    "schema_validation_errors",
    "config_load_ms",
    "config_load_errors",
    "pathfinder_find_ms",
    "pathfinder_validation_errors",
    "pathfinder_security_warnings",
    "foundry_lookup_count",
    "logging_emit_count",
    "logging_emit_latency_ms",
    "goneat_command_duration_ms",
  ];
  return validNames.includes(name as MetricName);
}

/**
 * Type guard to check if unit is valid
 */
export function isValidMetricUnit(unit: string): unit is MetricUnit {
  const validUnits: MetricUnit[] = ["count", "ms", "bytes", "percent"];
  return validUnits.includes(unit as MetricUnit);
}
