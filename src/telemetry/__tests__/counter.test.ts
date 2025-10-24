/**
 * Counter tests - unit tests for Counter metric
 */

import { describe, expect, test } from 'vitest';
import { Counter } from '../counter.js';

describe('Counter', () => {
  test('initializes with zero value', () => {
    const counter = new Counter('schema_validations');
    expect(counter.getValue()).toBe(0);
    expect(counter.name).toBe('schema_validations');
  });

  test('increments by 1 when no delta provided', () => {
    const counter = new Counter('schema_validations');
    counter.inc();
    expect(counter.getValue()).toBe(1);
  });

  test('increments by specified delta', () => {
    const counter = new Counter('schema_validations');
    counter.inc(5);
    expect(counter.getValue()).toBe(5);
    counter.inc(10);
    expect(counter.getValue()).toBe(15);
  });

  test('rejects negative delta', () => {
    const counter = new Counter('schema_validations');
    expect(() => counter.inc(-1)).toThrow('Counter delta must be non-negative');
    expect(counter.getValue()).toBe(0); // Value unchanged
  });

  test('handles multiple increments', () => {
    const counter = new Counter('schema_validations');
    counter.inc();
    counter.inc();
    counter.inc(3);
    expect(counter.getValue()).toBe(5);
  });

  test('resets to zero', () => {
    const counter = new Counter('schema_validations');
    counter.inc(42);
    expect(counter.getValue()).toBe(42);
    counter.reset();
    expect(counter.getValue()).toBe(0);
  });

  test('handles zero delta', () => {
    const counter = new Counter('schema_validations');
    counter.inc(0);
    expect(counter.getValue()).toBe(0);
  });

  test('handles large values', () => {
    const counter = new Counter('schema_validations');
    counter.inc(1000000);
    expect(counter.getValue()).toBe(1000000);
  });
});
