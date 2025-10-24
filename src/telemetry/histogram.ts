/**
 * Histogram metric implementation
 *
 * Histogram with OTLP-compatible cumulative buckets, auto-applying ADR-0007
 * default buckets for _ms metrics.
 */

import { DEFAULT_MS_BUCKETS } from './taxonomy.js';
import type { HistogramBucket, HistogramOptions, HistogramSummary, MetricName } from './types.js';

/**
 * Histogram metric
 *
 * Tracks distribution of values using cumulative buckets (OTLP-compatible).
 * Automatically applies ADR-0007 default buckets for _ms metrics.
 */
export class Histogram {
  private count = 0;
  private sum = 0;
  private bucketCounts: Map<number, number> = new Map();
  private readonly buckets: number[];

  constructor(
    public readonly name: MetricName,
    options?: HistogramOptions,
  ) {
    // Determine buckets: custom > ADR-0007 defaults for _ms metrics > empty
    if (options?.buckets) {
      this.buckets = [...options.buckets].sort((a, b) => a - b);
    } else if (name.endsWith('_ms')) {
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
   * @param value - Value to observe (typically a duration in ms)
   *
   * @example
   * ```typescript
   * const start = performance.now();
   * // ... operation ...
   * histogram.observe(performance.now() - start);
   * ```
   */
  observe(value: number): void {
    this.count++;
    this.sum += value;

    // Update cumulative bucket counts
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        this.bucketCounts.set(bucket, (this.bucketCounts.get(bucket) || 0) + 1);
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
   * Reset histogram to initial state
   */
  reset(): void {
    this.count = 0;
    this.sum = 0;
    for (const bucket of this.buckets) {
      this.bucketCounts.set(bucket, 0);
    }
  }
}
