/**
 * Gauge metric implementation
 *
 * Gauge for arbitrary values that can go up and down
 */

import type { MetricName } from "./types.js";

/**
 * Gauge metric
 *
 * Arbitrary value that can increase or decrease.
 * Supports labeled metrics (Crucible v0.2.7+).
 * Use for metrics like current connections, memory usage, temperature, etc.
 */
export class Gauge {
  private value = 0;
  private labeledValues = new Map<string, number>();

  constructor(public readonly name: MetricName) {}

  /**
   * Set gauge to specific value
   *
   * @param value - New gauge value (can be any number, including negative)
   * @param labels - Optional label dimensions for this observation
   *
   * @example
   * ```typescript
   * gauge.set(42);                              // Set unlabeled to 42
   * gauge.set(-10);                             // Negative values allowed
   * gauge.set(1, { phase: 'collect' });         // Set labeled instance
   * ```
   */
  set(value: number, labels?: Record<string, string>): void {
    if (labels && Object.keys(labels).length > 0) {
      const labelKey = this.serializeLabels(labels);
      this.labeledValues.set(labelKey, value);
    } else {
      this.value = value;
    }
  }

  /**
   * Increment gauge by delta (default: 1)
   *
   * @param delta - Amount to increment (can be negative)
   * @param labels - Optional label dimensions for this observation
   */
  inc(delta = 1, labels?: Record<string, string>): void {
    if (labels && Object.keys(labels).length > 0) {
      const labelKey = this.serializeLabels(labels);
      const current = this.labeledValues.get(labelKey) || 0;
      this.labeledValues.set(labelKey, current + delta);
    } else {
      this.value += delta;
    }
  }

  /**
   * Decrement gauge by delta (default: 1)
   *
   * @param delta - Amount to decrement (can be negative)
   * @param labels - Optional label dimensions for this observation
   */
  dec(delta = 1, labels?: Record<string, string>): void {
    if (labels && Object.keys(labels).length > 0) {
      const labelKey = this.serializeLabels(labels);
      const current = this.labeledValues.get(labelKey) || 0;
      this.labeledValues.set(labelKey, current - delta);
    } else {
      this.value -= delta;
    }
  }

  /**
   * Get current gauge value (unlabeled)
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
   * Reset gauge to zero (all label combinations)
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
      .join(",");
  }
}
