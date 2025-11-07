/**
 * Metrics registry - central registry for all metrics
 *
 * Provides singleton registry for counters, gauges, and histograms.
 * Exports events in schema-compliant format.
 */

import { Counter } from './counter.js';
import { Gauge } from './gauge.js';
import { Histogram } from './histogram.js';
import { getDefaultUnit } from './taxonomy.js';
import type { FlushOptions, HistogramOptions, MetricName, MetricsEvent } from './types.js';

/**
 * Metrics registry
 *
 * Central registry for all metrics. Provides factory methods for counters,
 * gauges, and histograms. Exports metrics as schema-compliant events.
 */
export class MetricsRegistry {
  private counters: Map<MetricName, Counter> = new Map();
  private gauges: Map<MetricName, Gauge> = new Map();
  private histograms: Map<MetricName, Histogram> = new Map();

  /**
   * Get or create a counter
   *
   * @param name - Metric name from taxonomy
   * @returns Counter instance
   *
   * @example
   * ```typescript
   * const counter = registry.counter('schema_validations');
   * counter.inc();
   * ```
   */
  counter(name: MetricName): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter(name);
      this.counters.set(name, counter);
    }
    return counter;
  }

  /**
   * Get or create a gauge
   *
   * @param name - Metric name from taxonomy
   * @returns Gauge instance
   *
   * @example
   * ```typescript
   * const gauge = registry.gauge('foundry_lookup_count');
   * gauge.set(42);
   * ```
   */
  gauge(name: MetricName): Gauge {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge(name);
      this.gauges.set(name, gauge);
    }
    return gauge;
  }

  /**
   * Get or create a histogram
   *
   * @param name - Metric name from taxonomy
   * @param options - Optional histogram options
   * @returns Histogram instance
   *
   * @example
   * ```typescript
   * // Auto-applies ADR-0007 buckets for _ms metrics
   * const histogram = registry.histogram('config_load_ms');
   * histogram.observe(42.5);
   *
   * // Custom buckets
   * const custom = registry.histogram('custom_metric', {
   *   buckets: [10, 50, 100, 500, 1000]
   * });
   * ```
   */
  histogram(name: MetricName, options?: HistogramOptions): Histogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = new Histogram(name, options);
      this.histograms.set(name, histogram);
    }
    return histogram;
  }

  /**
   * Export all metrics as events
   *
   * Returns array of schema-compliant MetricsEvent objects.
   * Does not clear metrics (use flush() to clear after export).
   *
   * @returns Promise resolving to array of metrics events
   *
   * @example
   * ```typescript
   * const events = await registry.export();
   * console.log(JSON.stringify(events, null, 2));
   * ```
   */
  async export(): Promise<MetricsEvent[]> {
    const events: MetricsEvent[] = [];
    const timestamp = new Date().toISOString();

    // Export counters (unlabeled + labeled) - Crucible v0.2.7+
    for (const [name, counter] of this.counters) {
      const unit = await getDefaultUnit(name);

      // Always export unlabeled value (for backwards compatibility)
      events.push({
        timestamp,
        name,
        value: counter.getValue(),
        unit,
      });

      // Export labeled values (only if > 0)
      for (const [labelKey, value] of counter.getLabeledValues()) {
        if (value > 0) {
          const tags = this.deserializeLabels(labelKey);
          events.push({
            timestamp,
            name,
            value,
            tags,
            unit,
          });
        }
      }
    }

    // Export gauges (unlabeled + labeled) - Crucible v0.2.7+
    for (const [name, gauge] of this.gauges) {
      const unit = await getDefaultUnit(name);

      // Export unlabeled value (always export gauges, even if zero)
      events.push({
        timestamp,
        name,
        value: gauge.getValue(),
        unit,
      });

      // Export labeled values
      for (const [labelKey, value] of gauge.getLabeledValues()) {
        const tags = this.deserializeLabels(labelKey);
        events.push({
          timestamp,
          name,
          value,
          tags,
          unit,
        });
      }
    }

    // Export histograms (unlabeled + labeled) - Crucible v0.2.7+
    for (const [name, histogram] of this.histograms) {
      const unit = await getDefaultUnit(name);

      // Always export unlabeled summary (for backwards compatibility)
      events.push({
        timestamp,
        name,
        value: histogram.getSummary(),
        unit,
      });

      // Export labeled summaries (only if count > 0)
      for (const [labelKey, summary] of histogram.getLabeledSummaries()) {
        if (summary.count > 0) {
          const tags = this.deserializeLabels(labelKey);
          events.push({
            timestamp,
            name,
            value: summary,
            tags,
            unit,
          });
        }
      }
    }

    return events;
  }

  /**
   * Deserialize label key back to tags object
   * Format: key1=value1,key2=value2 → {key1: "value1", key2: "value2"}
   */
  private deserializeLabels(labelKey: string): Record<string, string> {
    if (!labelKey) {
      return {};
    }

    const tags: Record<string, string> = {};
    for (const pair of labelKey.split(',')) {
      const [key, value] = pair.split('=');
      if (key && value) {
        tags[key] = value;
      }
    }
    return tags;
  }

  /**
   * Export and clear all metrics
   *
   * Exports metrics as events, optionally emits them via logger,
   * then resets all metrics to zero.
   *
   * @param options - Flush options
   * @returns Promise resolving to array of exported events
   *
   * @example
   * ```typescript
   * // Export and clear
   * const events = await registry.flush();
   *
   * // Export, emit to logger, and clear
   * const events = await registry.flush({
   *   emit: (events) => console.log(JSON.stringify(events))
   * });
   * ```
   */
  async flush(options?: FlushOptions): Promise<MetricsEvent[]> {
    const events = await this.export();

    try {
      // Emit if logger provided
      if (options?.emit) {
        options.emit(events);
      }
    } finally {
      // Always clear metrics, even if emit throws
      this.clear();
    }

    return events;
  }

  /**
   * Clear all metrics (reset to zero)
   *
   * Resets all counters, gauges, and histograms to their initial state.
   */
  clear(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
  }

  /**
   * Get all registered metric names
   *
   * Returns array of all metric names that have been accessed
   * (counters, gauges, or histograms).
   */
  getMetricNames(): MetricName[] {
    const names = new Set<MetricName>();
    for (const name of this.counters.keys()) {
      names.add(name);
    }
    for (const name of this.gauges.keys()) {
      names.add(name);
    }
    for (const name of this.histograms.keys()) {
      names.add(name);
    }
    return Array.from(names);
  }

  /**
   * Get total count of registered metrics
   */
  getMetricCount(): number {
    return this.counters.size + this.gauges.size + this.histograms.size;
  }
}
