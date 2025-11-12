/**
 * Prometheus exporter for TSFulmen telemetry
 *
 * @module telemetry/prometheus
 */

export {
  ADR0007_BUCKETS_MS,
  ADR0007_BUCKETS_SECONDS,
  ERROR_HANDLING_METRICS,
  EXPORTER_LABELS,
  FOUNDRY_METRICS,
  FULHASH_METRICS,
  msToSeconds,
  PROMETHEUS_EXPORTER_METRICS,
} from "./constants.js";
export {
  InvalidLabelNameError,
  InvalidMetricNameError,
  MetricRegistrationError,
  PromClientNotFoundError,
  PrometheusExporterError,
  RefreshError,
} from "./errors.js";
export { PrometheusExporter } from "./exporter.js";
export { registerPrometheusShutdown } from "./lifecycle.js";
export {
  createMetricsHandler,
  type RequestContext,
  startMetricsServer,
  stopMetricsServer,
} from "./server.js";
export type {
  ExporterStats,
  PrometheusExporterOptions,
  RefreshOptions,
  ServerOptions,
} from "./types.js";
