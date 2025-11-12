/**
 * Prometheus exporter constants
 *
 * ADR-0007 histogram buckets and metric names from Crucible v0.2.7 taxonomy.
 */

/**
 * ADR-0007 histogram buckets for millisecond timing
 *
 * Buckets: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s
 * Used for: MIME detection, error handling, FulHash operations
 */
export const ADR0007_BUCKETS_MS = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000] as const;

/**
 * ADR-0007 histogram buckets for second timing (refresh operations)
 *
 * Buckets: 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s (converted to seconds)
 * Used for: Prometheus exporter refresh duration
 */
export const ADR0007_BUCKETS_SECONDS = [
  0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0,
] as const;

/**
 * Convert milliseconds to seconds for Prometheus histograms
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Prometheus exporter metric names (Crucible v0.2.7 taxonomy)
 */
export const PROMETHEUS_EXPORTER_METRICS = {
  // Refresh metrics
  REFRESH_DURATION_SECONDS: "prometheus_exporter_refresh_duration_seconds",
  REFRESH_TOTAL: "prometheus_exporter_refresh_total",
  REFRESH_ERRORS_TOTAL: "prometheus_exporter_refresh_errors_total",
  REFRESH_INFLIGHT: "prometheus_exporter_refresh_inflight",

  // HTTP metrics
  HTTP_REQUESTS_TOTAL: "prometheus_exporter_http_requests_total",
  HTTP_ERRORS_TOTAL: "prometheus_exporter_http_errors_total",

  // Restart metrics
  RESTARTS_TOTAL: "prometheus_exporter_restarts_total",
} as const;

/**
 * Foundry module metric names (Crucible v0.2.7 taxonomy)
 */
export const FOUNDRY_METRICS = {
  // MIME detection counters
  MIME_DETECTIONS_JSON: "foundry_mime_detections_total_json",
  MIME_DETECTIONS_XML: "foundry_mime_detections_total_xml",
  MIME_DETECTIONS_YAML: "foundry_mime_detections_total_yaml",
  MIME_DETECTIONS_CSV: "foundry_mime_detections_total_csv",
  MIME_DETECTIONS_PLAIN_TEXT: "foundry_mime_detections_total_plain_text",
  MIME_DETECTIONS_UNKNOWN: "foundry_mime_detections_total_unknown",

  // MIME detection timing histograms
  MIME_DETECTION_MS_JSON: "foundry_mime_detection_ms_json",
  MIME_DETECTION_MS_XML: "foundry_mime_detection_ms_xml",
  MIME_DETECTION_MS_YAML: "foundry_mime_detection_ms_yaml",
  MIME_DETECTION_MS_CSV: "foundry_mime_detection_ms_csv",
  MIME_DETECTION_MS_PLAIN_TEXT: "foundry_mime_detection_ms_plain_text",
  MIME_DETECTION_MS_UNKNOWN: "foundry_mime_detection_ms_unknown",

  // General lookup counter
  LOOKUP_COUNT: "foundry_lookup_count",
} as const;

/**
 * Error handling module metric names (Crucible v0.2.7 taxonomy)
 */
export const ERROR_HANDLING_METRICS = {
  WRAPS_TOTAL: "error_handling_wraps_total",
  WRAP_MS: "error_handling_wrap_ms",
} as const;

/**
 * FulHash module metric names (Crucible v0.2.7 taxonomy)
 */
export const FULHASH_METRICS = {
  // Algorithm-specific counters
  OPERATIONS_XXH3_128: "fulhash_operations_total_xxh3_128",
  OPERATIONS_SHA256: "fulhash_operations_total_sha256",

  // General counters
  HASH_STRING_TOTAL: "fulhash_hash_string_total",
  BYTES_HASHED_TOTAL: "fulhash_bytes_hashed_total",

  // Timing histogram
  OPERATION_MS: "fulhash_operation_ms",
} as const;

/**
 * Label values for Prometheus exporter metrics (taxonomy-compliant)
 */
export const EXPORTER_LABELS = {
  // Refresh phases
  PHASE_COLLECT: "collect",
  PHASE_CONVERT: "convert",
  PHASE_EXPORT: "export",

  // Results
  RESULT_SUCCESS: "success",
  RESULT_ERROR: "error",

  // Error types
  ERROR_VALIDATION: "validation",
  ERROR_IO: "io",
  ERROR_TIMEOUT: "timeout",
  ERROR_OTHER: "other",

  // Restart reasons
  REASON_CONFIG_CHANGE: "config_change",
  REASON_ERROR: "error",
  REASON_MANUAL: "manual",
  REASON_OTHER: "other",
} as const;
