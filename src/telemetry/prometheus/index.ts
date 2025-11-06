/**
 * Prometheus exporter for TSFulmen telemetry
 *
 * @module telemetry/prometheus
 */

export {
  InvalidLabelNameError,
  InvalidMetricNameError,
  MetricRegistrationError,
  PromClientNotFoundError,
  PrometheusExporterError,
  RefreshError,
} from './errors.js';
export { PrometheusExporter } from './exporter.js';
export { registerPrometheusShutdown } from './lifecycle.js';
export {
  createMetricsHandler,
  type RequestContext,
  startMetricsServer,
  stopMetricsServer,
} from './server.js';
export type {
  ExporterStats,
  PrometheusExporterOptions,
  RefreshOptions,
  ServerOptions,
} from './types.js';
