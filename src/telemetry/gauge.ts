/**
 * Gauge metric implementation
 *
 * Gauge for arbitrary values that can go up and down
 */

import type { MetricName } from './types.js';

/**
 * Gauge metric
 *
 * Arbitrary value that can increase or decrease.
 * Use for metrics like current connections, memory usage, temperature, etc.
 */
export class Gauge {
  private value = 0;

  constructor(public readonly name: MetricName) {}

  /**
   * Set gauge to specific value
   *
   * @param value - New gauge value (can be any number, including negative)
   *
   * @example
   * ```typescript
   * gauge.set(42);     // Set to 42
   * gauge.set(-10);    // Negative values allowed
   * gauge.set(0);      // Reset to zero
   * ```
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Increment gauge by delta (default: 1)
   *
   * @param delta - Amount to increment (can be negative)
   */
  inc(delta = 1): void {
    this.value += delta;
  }

  /**
   * Decrement gauge by delta (default: 1)
   *
   * @param delta - Amount to decrement (can be negative)
   */
  dec(delta = 1): void {
    this.value -= delta;
  }

  /**
   * Get current gauge value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Reset gauge to zero
   */
  reset(): void {
    this.value = 0;
  }
}
