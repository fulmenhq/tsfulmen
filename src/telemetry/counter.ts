/**
 * Counter metric implementation
 *
 * Monotonically increasing counter for counting events
 */

import type { MetricName } from './types.js';

/**
 * Counter metric
 *
 * Monotonically increasing value for counting events.
 * Supports labeled metrics (Crucible v0.2.7+).
 * Use for metrics like request counts, error counts, etc.
 */
export class Counter {
  private value = 0;
  private labeledValues = new Map<string, number>();

  constructor(public readonly name: MetricName) {}

  /**
   * Increment counter by delta (default: 1)
   *
   * @param delta - Amount to increment (must be non-negative)
   * @param labels - Optional label dimensions for this observation
   * @throws {Error} If delta is negative
   *
   * @example
   * ```typescript
   * counter.inc();                              // Increment unlabeled by 1
   * counter.inc(5);                             // Increment unlabeled by 5
   * counter.inc(1, { status: '200' });          // Increment labeled instance
   * counter.inc(1, { result: 'success' });      // Different label set
   * ```
   */
  inc(delta = 1, labels?: Record<string, string>): void {
    if (delta < 0) {
      throw new Error(`Counter delta must be non-negative, got: ${delta}`);
    }

    if (labels && Object.keys(labels).length > 0) {
      // Labeled metric - track per label combination
      const labelKey = this.serializeLabels(labels);
      const current = this.labeledValues.get(labelKey) || 0;
      this.labeledValues.set(labelKey, current + delta);
    } else {
      // Unlabeled metric
      this.value += delta;
    }
  }

  /**
   * Get current counter value (unlabeled)
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get all labeled values
   * @returns Map of serialized label keys to values
   */
  getLabeledValues(): Map<string, number> {
    return new Map(this.labeledValues);
  }

  /**
   * Get value for specific label combination
   */
  getValueForLabels(labels: Record<string, string>): number {
    const labelKey = this.serializeLabels(labels);
    return this.labeledValues.get(labelKey) || 0;
  }

  /**
   * Reset counter to zero (all label combinations)
   */
  reset(): void {
    this.value = 0;
    this.labeledValues.clear();
  }

  /**
   * Serialize labels to deterministic string key
   * Format: key1=value1,key2=value2 (sorted by key)
   */
  private serializeLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }
}
