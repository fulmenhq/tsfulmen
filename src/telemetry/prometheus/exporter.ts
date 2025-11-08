/**
 * Prometheus exporter core implementation
 *
 * Bridges TSFulmen TelemetryRegistry to prom-client for Prometheus exposition.
 * Uses dynamic imports and loose typing for optional peer dependency (prom-client).
 *
 * NOTE: This file intentionally uses 'any' types for prom-client peer dependency
 * to avoid compile-time dependency. Runtime validation ensures type safety.
 * See .plans/active/v0.2.x-plans/prometheus-type-safety-enhancement.md for future work.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { metrics as defaultRegistry } from '../index.js';
import type { MetricsEvent } from '../types.js';
import { isHistogramSummary } from '../types.js';
import {
  ADR0007_BUCKETS_SECONDS,
  EXPORTER_LABELS,
  msToSeconds,
  PROMETHEUS_EXPORTER_METRICS,
} from './constants.js';
import {
  InvalidLabelNameError,
  InvalidMetricNameError,
  MetricRegistrationError,
  PromClientNotFoundError,
  RefreshError,
} from './errors.js';
import type { ExporterStats, PrometheusExporterOptions, RefreshOptions } from './types.js';

/**
 * Prometheus exporter
 *
 * Converts TSFulmen TelemetryRegistry metrics to Prometheus format using prom-client.
 *
 * @example
 * ```typescript
 * import { PrometheusExporter } from '@fulmenhq/tsfulmen/telemetry/prometheus';
 * import { metrics } from '@fulmenhq/tsfulmen/telemetry';
 *
 * // Create exporter
 * const exporter = new PrometheusExporter({
 *   registry: metrics,
 *   namespace: 'myapp',
 *   defaultLabels: { environment: 'production' }
 * });
 *
 * // Refresh metrics from registry
 * await exporter.refresh();
 *
 * // Get Prometheus text format
 * const output = await exporter.getMetrics();
 * console.log(output);
 * ```
 */
export class PrometheusExporter {
  private readonly telemetryRegistry: typeof defaultRegistry;
  private namespace: string;
  private subsystem: string;
  private readonly defaultLabels: Record<string, string>;
  private readonly helpText: Record<string, string>;
  private readonly metricsEnabled: boolean;
  private readonly recordClientLabel: boolean;
  private readonly moduleMetricsEnabled: boolean;

  // prom-client types unavailable at compile time (optional peer dependency)
  // Using 'any' with runtime validation - see file header comment for rationale
  // biome-ignore lint/suspicious/noExplicitAny: prom-client is optional peer dependency
  private promClient: any = null;
  // biome-ignore lint/suspicious/noExplicitAny: prom-client Registry type unavailable at compile time
  private promRegistry: any = null;
  // biome-ignore lint/suspicious/noExplicitAny: prom-client Counter type unavailable at compile time
  private counters: Map<string, any> = new Map();
  // biome-ignore lint/suspicious/noExplicitAny: prom-client Gauge type unavailable at compile time
  private gauges: Map<string, any> = new Map();
  // biome-ignore lint/suspicious/noExplicitAny: prom-client Histogram type unavailable at compile time
  private histograms: Map<string, any> = new Map();

  // Statistics
  private refreshCount = 0;
  private errorCount = 0;
  private lastRefreshTime: string | null = null;

  // Background refresh loop
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<void> | null = null;
  private isRefreshing = false;

  /**
   * Create Prometheus exporter
   *
   * @param options - Exporter configuration
   * @throws {InvalidLabelNameError} If default label names are invalid
   */
  constructor(options: PrometheusExporterOptions = {}) {
    this.telemetryRegistry = options.registry || defaultRegistry;
    this.defaultLabels = options.defaultLabels || {};
    this.helpText = options.helpText || {};
    this.metricsEnabled = options.metricsEnabled ?? true;
    this.recordClientLabel = options.recordClientLabel ?? false;
    this.moduleMetricsEnabled = options.moduleMetricsEnabled ?? true;

    // Validate default label names
    for (const labelName of Object.keys(this.defaultLabels)) {
      this.validateLabelName(labelName);
    }

    // Initialize namespace and subsystem
    // May be overridden by App Identity in init()
    this.namespace = options.namespace || 'tsfulmen';
    this.subsystem = options.subsystem || 'app';
  }

  /**
   * Initialize exporter (async setup)
   *
   * Loads prom-client and optionally loads App Identity for namespace/subsystem.
   * Called automatically on first refresh() or getMetrics() call.
   *
   * @throws {PromClientNotFoundError} If prom-client not installed
   */
  private async init(): Promise<void> {
    if (this.promClient) {
      return; // Already initialized
    }

    // Lazy load prom-client (peer dependency)
    try {
      this.promClient = await import('prom-client');
      this.promRegistry = new this.promClient.Registry();
    } catch (err) {
      throw new PromClientNotFoundError(err);
    }

    // Try to load App Identity for namespace/subsystem (optional)
    if (this.namespace === 'tsfulmen' || this.subsystem === 'app') {
      try {
        const { loadIdentity } = await import('../../appidentity/index.js');
        const identity = await loadIdentity({ skipValidation: true });

        if (this.namespace === 'tsfulmen' && identity.app.vendor) {
          this.namespace = identity.app.vendor;
        }
        if (this.subsystem === 'app' && identity.app.binary_name) {
          this.subsystem = identity.app.binary_name;
        }
      } catch {
        // App Identity not available - use defaults
      }
    }
  }

  /**
   * Safely emit instrumentation metric (silently fails if registry doesn't support it)
   * Used to avoid breaking tests that use mock registries
   */
  private safeInstrument(fn: () => void): void {
    try {
      fn();
    } catch {
      // Silently ignore instrumentation failures (e.g., mock registries in tests)
    }
  }

  /**
   * Refresh metrics from TelemetryRegistry
   *
   * Exports current metrics from TelemetryRegistry and updates Prometheus collectors.
   * Emits instrumentation metrics per Crucible v0.2.7 taxonomy.
   *
   * @throws {RefreshError} If refresh operation fails. Inspect `error.cause` for the
   * underlying error (InvalidMetricNameError, MetricRegistrationError, etc.) to handle
   * specific failure conditions.
   */
  async refresh(): Promise<void> {
    const startTime = performance.now();

    // Set inflight gauge to 1
    this.safeInstrument(() => {
      this.telemetryRegistry.gauge(PROMETHEUS_EXPORTER_METRICS.REFRESH_INFLIGHT).set(1);
    });

    try {
      // Phase: collect - export from telemetry registry
      await this.init();
      const events = await this.telemetryRegistry.export();

      // Phase: convert - update Prometheus collectors
      for (const event of events) {
        this.updateCollector(event);
      }

      // Success metrics
      this.refreshCount++;
      this.lastRefreshTime = new Date().toISOString();

      const durationMs = performance.now() - startTime;

      // Emit success metrics
      this.safeInstrument(() => {
        this.telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.REFRESH_TOTAL)
          .inc(1, { result: EXPORTER_LABELS.RESULT_SUCCESS });

        this.telemetryRegistry
          .histogram(PROMETHEUS_EXPORTER_METRICS.REFRESH_DURATION_SECONDS, {
            buckets: [...ADR0007_BUCKETS_SECONDS],
          })
          .observe(msToSeconds(durationMs), {
            phase: EXPORTER_LABELS.PHASE_EXPORT,
            result: EXPORTER_LABELS.RESULT_SUCCESS,
          });
      });
    } catch (err) {
      this.errorCount++;

      const durationMs = performance.now() - startTime;

      // Classify error type
      let errorType: string = EXPORTER_LABELS.ERROR_OTHER;
      if (err instanceof InvalidMetricNameError || err instanceof InvalidLabelNameError) {
        errorType = EXPORTER_LABELS.ERROR_VALIDATION;
      } else if (err instanceof MetricRegistrationError) {
        errorType = EXPORTER_LABELS.ERROR_OTHER;
      }

      // Emit error metrics
      this.safeInstrument(() => {
        this.telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.REFRESH_TOTAL)
          .inc(1, { result: EXPORTER_LABELS.RESULT_ERROR });

        this.telemetryRegistry
          .counter(PROMETHEUS_EXPORTER_METRICS.REFRESH_ERRORS_TOTAL)
          .inc(1, { error_type: errorType });

        this.telemetryRegistry
          .histogram(PROMETHEUS_EXPORTER_METRICS.REFRESH_DURATION_SECONDS, {
            buckets: [...ADR0007_BUCKETS_SECONDS],
          })
          .observe(msToSeconds(durationMs), {
            phase: EXPORTER_LABELS.PHASE_EXPORT,
            result: EXPORTER_LABELS.RESULT_ERROR,
          });
      });

      throw new RefreshError(err, {
        refreshCount: this.refreshCount,
        errorCount: this.errorCount,
      });
    } finally {
      // Clear inflight gauge
      this.safeInstrument(() => {
        this.telemetryRegistry.gauge(PROMETHEUS_EXPORTER_METRICS.REFRESH_INFLIGHT).set(0);
      });
    }
  }

  /**
   * Get Prometheus metrics in text format
   *
   * Returns metrics in Prometheus exposition text format.
   *
   * @returns Prometheus text format string
   */
  async getMetrics(): Promise<string> {
    await this.init();

    if (!this.promRegistry) {
      throw new Error('Prometheus registry not initialized');
    }

    return this.promRegistry.metrics();
  }

  /**
   * Get exporter statistics
   */
  getStats(): ExporterStats {
    return {
      refreshCount: this.refreshCount,
      errorCount: this.errorCount,
      lastRefreshTime: this.lastRefreshTime,
      metricsCount: this.counters.size + this.gauges.size + this.histograms.size,
      isRefreshing: this.isRefreshing,
    };
  }

  /**
   * Get current metrics configuration
   *
   * Returns effective configuration being used by exporter,
   * including defaults for any unspecified options.
   *
   * @returns Current metrics configuration
   */
  getMetricsConfig() {
    return {
      metricsEnabled: this.metricsEnabled,
      recordClientLabel: this.recordClientLabel,
      moduleMetricsEnabled: this.moduleMetricsEnabled,
      namespace: this.namespace,
      subsystem: this.subsystem,
      defaultLabels: { ...this.defaultLabels },
      helpText: { ...this.helpText },
    };
  }

  /**
   * Get underlying prom-client Registry
   *
   * Returns null if not yet initialized.
   * Use for advanced prom-client operations.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Returns prom-client Registry type (optional peer dependency)
  getRegistry(): any {
    return this.promRegistry;
  }

  /**
   * Get telemetry registry for self-instrumentation
   *
   * Returns the MetricsRegistry instance used for exporter self-instrumentation.
   * Useful for HTTP handler instrumentation.
   *
   * @internal
   */
  getTelemetryRegistry(): typeof defaultRegistry {
    return this.telemetryRegistry;
  }

  /**
   * Emit restart metric
   *
   * Records a restart event for tracking exporter or server restarts.
   * Use this when restarting the HTTP metrics server or other exporter components.
   *
   * @param reason - Reason for restart (config_change, error, manual, other)
   *
   * @example
   * ```typescript
   * // Restart server after config change
   * await stopMetricsServer(server);
   * exporter.recordRestart('config_change');
   * const newServer = await startMetricsServer(exporter, newConfig);
   * ```
   */
  recordRestart(reason: 'config_change' | 'error' | 'manual' | 'other'): void {
    this.safeInstrument(() => {
      this.telemetryRegistry.counter(PROMETHEUS_EXPORTER_METRICS.RESTARTS_TOTAL).inc(1, { reason });
    });
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    if (this.promRegistry) {
      this.promRegistry.clear();
    }
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Start background refresh loop
   *
   * Automatically refreshes metrics from TelemetryRegistry at specified interval.
   * Useful for long-running services where metrics should be continuously updated.
   *
   * @param options - Refresh configuration (interval, error handler)
   *
   * @example
   * ```typescript
   * const exporter = new PrometheusExporter({ registry: metrics });
   *
   * // Start refreshing every 15 seconds (default)
   * exporter.startRefresh();
   *
   * // Custom interval and error handling
   * exporter.startRefresh({
   *   intervalMs: 10000,
   *   onError: (err) => logger.error('Refresh failed:', err)
   * });
   * ```
   */
  startRefresh(options: RefreshOptions = {}): void {
    const intervalMs = options.intervalMs ?? 15000;
    const _isRestart = !!this.refreshInterval;

    // Stop existing refresh if running (restart scenario)
    if (this.refreshInterval) {
      this.stopRefresh();

      // Emit restart metric
      this.safeInstrument(() => {
        this.telemetryRegistry.counter(PROMETHEUS_EXPORTER_METRICS.RESTARTS_TOTAL).inc(1, {
          reason: options.restartReason || EXPORTER_LABELS.REASON_OTHER,
        });
      });
    }

    // Start refresh loop
    this.refreshInterval = setInterval(() => {
      // Don't start new refresh if one is already running (serialization)
      if (this.refreshPromise) {
        return;
      }

      this.refreshPromise = this.refresh()
        .catch((err) => {
          // Call error handler if provided
          if (options.onError) {
            options.onError(err as Error);
          }
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }, intervalMs);

    // Update stats to indicate refreshing
    this.isRefreshing = true;
  }

  /**
   * Stop background refresh loop
   *
   * Clears the refresh interval and performs one final refresh to capture
   * the latest metrics state before stopping.
   *
   * @example
   * ```typescript
   * // Graceful shutdown
   * await exporter.stopRefresh();
   * ```
   */
  async stopRefresh(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Wait for any in-flight refresh to complete
    if (this.refreshPromise) {
      await this.refreshPromise;
    }

    // Perform final refresh to capture latest state
    try {
      await this.refresh();
    } catch (_err) {
      // Log but don't throw during shutdown
      // Error is already tracked in stats
    }

    // Update stats to indicate not refreshing
    this.isRefreshing = false;
  }

  /**
   * Update Prometheus collector from MetricsEvent
   */
  private updateCollector(event: MetricsEvent): void {
    const metricName = this.formatMetricName(event.name);
    const help = this.getHelpText(event.name);
    const labelNames = Object.keys(this.defaultLabels);

    if (isHistogramSummary(event.value)) {
      this.updateHistogram(metricName, help, labelNames, event.value);
    } else if (typeof event.value === 'number') {
      // Use Gauge for all scalar metrics (simplest approach)
      // TSFulmen doesn't distinguish Counter vs Gauge in export format
      this.updateGauge(metricName, help, labelNames, event.value);
    }
  }

  /**
   * Update or create Prometheus Gauge
   */
  private updateGauge(name: string, help: string, labelNames: string[], value: number): void {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      try {
        gauge = new this.promClient.Gauge({
          name,
          help,
          labelNames,
          registers: [this.promRegistry],
        });
        this.gauges.set(name, gauge);
      } catch (err) {
        throw new MetricRegistrationError(name, err);
      }
    }

    gauge.labels(this.defaultLabels).set(value);
  }

  /**
   * Update or create Prometheus Histogram
   *
   * CRITICAL: Converts OTLP cumulative buckets to Prometheus format.
   * This is an approximation - see Phase 0 investigation for details.
   *
   * LIMITATION: Original observations cannot be perfectly reconstructed from bucket summary.
   * Percentiles will be approximate based on bucket midpoints.
   */
  // biome-ignore lint/suspicious/noExplicitAny: summary is HistogramSummary from TelemetryRegistry
  private updateHistogram(name: string, help: string, labelNames: string[], summary: any): void {
    // biome-ignore lint/suspicious/noExplicitAny: bucket type from HistogramSummary
    const buckets = summary.buckets.map((b: any) => b.le);

    let histogram = this.histograms.get(name);
    if (!histogram) {
      try {
        histogram = new this.promClient.Histogram({
          name,
          help,
          labelNames,
          buckets,
          registers: [this.promRegistry],
        });
        this.histograms.set(name, histogram);
      } catch (err) {
        throw new MetricRegistrationError(name, err);
      }
    }

    // Reconstruct observations from summary
    const observations = this.reconstructObservations(summary);
    for (const value of observations) {
      histogram.labels(this.defaultLabels).observe(value);
    }
  }

  /**
   * Reconstruct observations from histogram summary
   *
   * Converts OTLP cumulative bucket counts to approximate observation values.
   * Uses bucket midpoints to generate synthetic observations.
   *
   * LIMITATION: This is an approximation. Original observation values cannot be
   * perfectly reconstructed from bucket summaries. Percentiles will be approximate
   * based on bucket boundaries. This is acceptable for v0.1.8 initial release.
   *
   * TODO: Future enhancement - capture raw observations in TelemetryRegistry
   * for lossless Prometheus export. Track in Phase 2+ planning.
   * See: .plans/active/v0.2.x-plans/prometheus-type-safety-enhancement.md
   *
   * Algorithm:
   * 1. Calculate non-cumulative count for each bucket (delta between adjacent buckets)
   * 2. For each bucket, place observations at the midpoint between bucket boundaries
   * 3. Return array of synthetic observation values
   */
  // biome-ignore lint/suspicious/noExplicitAny: summary is HistogramSummary from TelemetryRegistry
  private reconstructObservations(summary: any): number[] {
    const observations: number[] = [];
    const buckets = summary.buckets;

    if (!buckets || buckets.length === 0) {
      return observations;
    }

    let prevCount = 0;
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const count = bucket.count - prevCount; // Non-cumulative count for this bucket

      if (count > 0) {
        // Determine observation value (bucket midpoint)
        let value: number;
        if (i === 0) {
          // First bucket: midpoint between 0 and upper bound
          value = bucket.le / 2;
        } else {
          // Other buckets: midpoint between previous and current upper bound
          const prevLe = buckets[i - 1].le;
          value = (prevLe + bucket.le) / 2;
        }

        // Add 'count' observations at this value
        for (let j = 0; j < count; j++) {
          observations.push(value);
        }
      }

      prevCount = bucket.count;
    }

    return observations;
  }

  /**
   * Format metric name with namespace and subsystem prefix
   *
   * Format: {namespace}_{subsystem}_{metric}
   * Example: fulmen_myapp_schema_validations
   */
  private formatMetricName(name: string): string {
    this.validateMetricName(name);
    return `${this.namespace}_${this.subsystem}_${name}`;
  }

  /**
   * Get help text for metric
   *
   * Uses custom help text if provided, otherwise generates default.
   */
  private getHelpText(name: string): string {
    if (this.helpText[name]) {
      return this.helpText[name];
    }
    return `TSFulmen metric: ${name}`;
  }

  /**
   * Validate Prometheus metric name
   *
   * Rules: Must start with [a-zA-Z_:] and contain only [a-zA-Z0-9_:]
   *
   * @throws {InvalidMetricNameError} If name is invalid
   */
  private validateMetricName(name: string): void {
    const validPattern = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
    if (!validPattern.test(name)) {
      throw new InvalidMetricNameError(
        name,
        'Metric names must start with [a-zA-Z_:] and contain only [a-zA-Z0-9_:]',
      );
    }
  }

  /**
   * Validate Prometheus label name
   *
   * Rules: Must start with [a-zA-Z_] and contain only [a-zA-Z0-9_]
   *
   * @throws {InvalidLabelNameError} If name is invalid
   */
  private validateLabelName(name: string): void {
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validPattern.test(name)) {
      throw new InvalidLabelNameError(
        name,
        'Label names must start with [a-zA-Z_] and contain only [a-zA-Z0-9_]',
      );
    }
  }
}
