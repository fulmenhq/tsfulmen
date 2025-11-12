/**
 * Histogram metric implementation
 *
 * Histogram with OTLP-compatible cumulative buckets, auto-applying ADR-0007
 * default buckets for _ms metrics.
 */

import { DEFAULT_MS_BUCKETS } from "./taxonomy.js";
import type { HistogramBucket, HistogramOptions, HistogramSummary, MetricName } from "./types.js";

/**
 * Labeled histogram state
 */
interface LabeledHistogramState {
  count: number;
  sum: number;
  bucketCounts: Map<number, number>;
}

/**
 * Histogram metric
 *
 * Tracks distribution of values using cumulative buckets (OTLP-compatible).
 * Automatically applies ADR-0007 default buckets for _ms metrics.
 * Supports labeled metrics (Crucible v0.2.7+).
 */
export class Histogram {
  private count = 0;
  private sum = 0;
  private bucketCounts: Map<number, number> = new Map();
  private labeledStates = new Map<string, LabeledHistogramState>();
  private readonly buckets: number[];

  constructor(
    public readonly name: MetricName,
    options?: HistogramOptions,
  ) {
    // Determine buckets: custom > ADR-0007 defaults for _ms metrics > empty
    if (options?.buckets) {
      this.buckets = [...options.buckets].sort((a, b) => a - b);
    } else if (name.endsWith("_ms") || name.endsWith("_seconds")) {
      this.buckets = [...DEFAULT_MS_BUCKETS];
    } else {
      this.buckets = [];
    }

    // Initialize bucket counts
    for (const bucket of this.buckets) {
      this.bucketCounts.set(bucket, 0);
    }
  }

  /**
   * Record an observation
   *
   * @param value - Value to observe (typically a duration in ms or seconds)
   * @param labels - Optional label dimensions for this observation
   *
   * @example
   * ```typescript
   * const start = performance.now();
   * // ... operation ...
   * histogram.observe(performance.now() - start);
   * histogram.observe(duration, { phase: 'collect', result: 'success' });
   * ```
   */
  observe(value: number, labels?: Record<string, string>): void {
    if (labels && Object.keys(labels).length > 0) {
      // Labeled observation
      const labelKey = this.serializeLabels(labels);
      let state = this.labeledStates.get(labelKey);

      if (!state) {
        // Initialize new labeled state
        state = {
          count: 0,
          sum: 0,
          bucketCounts: new Map(),
        };
        for (const bucket of this.buckets) {
          state.bucketCounts.set(bucket, 0);
        }
        this.labeledStates.set(labelKey, state);
      }

      state.count++;
      state.sum += value;

      // Update cumulative bucket counts
      for (const bucket of this.buckets) {
        if (value <= bucket) {
          state.bucketCounts.set(bucket, (state.bucketCounts.get(bucket) || 0) + 1);
        }
      }
    } else {
      // Unlabeled observation
      this.count++;
      this.sum += value;

      // Update cumulative bucket counts
      for (const bucket of this.buckets) {
        if (value <= bucket) {
          this.bucketCounts.set(bucket, (this.bucketCounts.get(bucket) || 0) + 1);
        }
      }
    }
  }

  /**
   * Get histogram summary
   *
   * Returns OTLP-compatible histogram summary with cumulative bucket counts.
   */
  getSummary(): HistogramSummary {
    const buckets: HistogramBucket[] = this.buckets.map((le) => ({
      le,
      count: this.bucketCounts.get(le) || 0,
    }));

    return {
      count: this.count,
      sum: this.sum,
      buckets,
    };
  }

  /**
   * Get current observation count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get sum of all observed values
   */
  getSum(): number {
    return this.sum;
  }

  /**
   * Get average of observed values
   */
  getAverage(): number {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /**
   * Get all labeled summaries
   * @returns Map of serialized label keys to histogram summaries
   */
  getLabeledSummaries(): Map<string, HistogramSummary> {
    const summaries = new Map<string, HistogramSummary>();

    for (const [labelKey, state] of this.labeledStates) {
      const buckets: HistogramBucket[] = this.buckets.map((le) => ({
        le,
        count: state.bucketCounts.get(le) || 0,
      }));

      summaries.set(labelKey, {
        count: state.count,
        sum: state.sum,
        buckets,
      });
    }

    return summaries;
  }

  /**
   * Get summary for specific label combination
   */
  getSummaryForLabels(labels: Record<string, string>): HistogramSummary | null {
    const labelKey = this.serializeLabels(labels);
    const state = this.labeledStates.get(labelKey);

    if (!state) {
      return null;
    }

    const buckets: HistogramBucket[] = this.buckets.map((le) => ({
      le,
      count: state.bucketCounts.get(le) || 0,
    }));

    return {
      count: state.count,
      sum: state.sum,
      buckets,
    };
  }

  /**
   * Reset histogram to initial state (all label combinations)
   */
  reset(): void {
    this.count = 0;
    this.sum = 0;
    for (const bucket of this.buckets) {
      this.bucketCounts.set(bucket, 0);
    }
    this.labeledStates.clear();
  }

  /**
   * Serialize labels to deterministic string key
   * Format: key1=value1,key2=value2 (sorted by key)
   */
  private serializeLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
  }
}
