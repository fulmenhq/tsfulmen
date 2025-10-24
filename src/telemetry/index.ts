/**
 * Telemetry module - metrics collection and export
 *
 * Provides counter, gauge, and histogram metrics with schema validation
 * and taxonomy-based defaults (ADR-0007).
 */

export const VERSION = '1.0.0';

// Core registry and singleton
export { MetricsRegistry } from './registry.js';

import { MetricsRegistry } from './registry.js';

/**
 * Default singleton metrics registry
 *
 * Use this for application-wide metrics collection.
 *
 * @example
 * ```typescript
 * import { metrics } from '@fulmenhq/tsfulmen/telemetry';
 *
 * // Increment counter
 * metrics.counter('schema_validations').inc();
 *
 * // Record histogram observation
 * metrics.histogram('config_load_ms').observe(42.5);
 *
 * // Export all metrics
 * const events = await metrics.export();
 * ```
 */
export const metrics = new MetricsRegistry();

// Metric types
export { Counter } from './counter.js';
export { Gauge } from './gauge.js';
export { Histogram } from './histogram.js';
// Taxonomy
export type { MetricDefinition, MetricsTaxonomy } from './taxonomy.js';
export {
  DEFAULT_MS_BUCKETS,
  getDefaultBuckets,
  getDefaultUnit,
  getMetric,
  getTaxonomy,
  isValidMetricName as isValidMetricNameTaxonomy,
} from './taxonomy.js';
// Types
export type {
  FlushOptions,
  HistogramBucket,
  HistogramOptions,
  HistogramSummary,
  MetricName,
  MetricsEvent,
  MetricUnit,
  MetricValue,
} from './types.js';
export {
  isHistogramSummary,
  isValidMetricName,
  isValidMetricUnit,
} from './types.js';

// Validators
export {
  assertValidMetricsEvent,
  formatValidationErrors,
  getValidationErrors,
  validateMetricsEvent,
  validateMetricsEvents,
} from './validators.js';
