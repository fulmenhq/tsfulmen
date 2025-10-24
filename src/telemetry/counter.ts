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
 * Use for metrics like request counts, error counts, etc.
 */
export class Counter {
  private value = 0;

  constructor(public readonly name: MetricName) {}

  /**
   * Increment counter by delta (default: 1)
   *
   * @param delta - Amount to increment (must be non-negative)
   * @throws {Error} If delta is negative
   *
   * @example
   * ```typescript
   * counter.inc();     // Increment by 1
   * counter.inc(5);    // Increment by 5
   * ```
   */
  inc(delta = 1): void {
    if (delta < 0) {
      throw new Error(`Counter delta must be non-negative, got: ${delta}`);
    }
    this.value += delta;
  }

  /**
   * Get current counter value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Reset counter to zero
   */
  reset(): void {
    this.value = 0;
  }
}
