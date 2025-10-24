/**
 * Severity Consistency Tests - Regression Prevention for HIGH Finding
 *
 * Tests ensure that severity_level is ALWAYS recomputed when severity changes,
 * preventing stale derived field bugs (ADR-0006 compliance).
 *
 * Related: .plans/active/v0.1.2/high-finding-severity-consistency.md
 */

import { describe, expect, test } from 'vitest';
import { FulmenError, type FulmenErrorData, SEVERITY_LEVELS, type SeverityName } from '../index.js';

describe('FulmenError.wrap() - Severity Consistency', () => {
  /**
   * TEST 1: Core regression test for HIGH finding
   * Ensures severity_level is recomputed when severity is overridden
   */
  test('recomputes severity_level when severity is overridden', () => {
    const original = FulmenError.fromError(new Error('test'), {
      code: 'TEST',
      severity: 'low', // level 1
    });

    expect(original.data.severity).toBe('low');
    expect(original.data.severity_level).toBe(1);

    const wrapped = FulmenError.wrap(original, {
      severity: 'critical', // level 4
    });

    // CRITICAL: Both fields must match
    expect(wrapped.data.severity).toBe('critical');
    expect(wrapped.data.severity_level).toBe(4);
    expect(wrapped.getSeverityLevel()).toBe(4);
  });

  /**
   * TEST 2: Comprehensive test of all severity transitions
   * Verifies consistency across all 25 possible severity transitions
   */
  test('maintains consistency across all severity transitions', () => {
    const severities: SeverityName[] = ['info', 'low', 'medium', 'high', 'critical'];

    for (const from of severities) {
      for (const to of severities) {
        const original = FulmenError.fromError(new Error('test'), {
          code: 'TEST',
          severity: from,
        });

        const wrapped = FulmenError.wrap(original, {
          severity: to,
        });

        const expectedLevel = SEVERITY_LEVELS[to];
        expect(wrapped.data.severity).toBe(to);
        expect(wrapped.data.severity_level).toBe(expectedLevel);
      }
    }
  });

  /**
   * TEST 3: No override case
   * Ensures severity consistency is preserved when not overriding
   */
  test('preserves severity consistency when not overridden', () => {
    const original = FulmenError.fromError(new Error('test'), {
      code: 'TEST',
      severity: 'high',
    });

    expect(original.data.severity).toBe('high');
    expect(original.data.severity_level).toBe(3);

    const wrapped = FulmenError.wrap(original, {
      context: { additional: 'data' },
      // No severity override
    });

    expect(wrapped.data.severity).toBe('high');
    expect(wrapped.data.severity_level).toBe(3);
  });

  /**
   * TEST 4: Multiple re-wraps
   * Ensures consistency through escalation chain
   */
  test('maintains consistency through multiple re-wraps', () => {
    let current = FulmenError.fromError(new Error('test'), {
      code: 'TEST',
      severity: 'info', // level 0
    });

    expect(current.data.severity_level).toBe(0);

    // Escalate through all severities
    const escalation: SeverityName[] = ['low', 'medium', 'high', 'critical'];

    for (const severity of escalation) {
      current = FulmenError.wrap(current, { severity });

      expect(current.data.severity).toBe(severity);
      expect(current.data.severity_level).toBe(SEVERITY_LEVELS[severity]);
    }

    // Final check: critical should be level 4
    expect(current.data.severity).toBe('critical');
    expect(current.data.severity_level).toBe(4);
  });

  /**
   * TEST 5: Timestamp updates on re-wrap
   * Ensures timestamp is updated when re-wrapping
   */
  test('updates timestamp when re-wrapping', async () => {
    const original = FulmenError.fromError(new Error('test'), {
      code: 'TEST',
    });

    const originalTimestamp = original.data.timestamp;
    expect(originalTimestamp).toBeDefined();

    // Wait to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const wrapped = FulmenError.wrap(original, {
      context: { additional: 'data' },
    });

    expect(wrapped.data.timestamp).toBeDefined();
    expect(wrapped.data.timestamp).not.toBe(originalTimestamp);
  });

  /**
   * TEST 6: Schema validation after re-wrap
   * Ensures wrapped errors validate against schema
   */
  test('produces schema-valid output after severity change', async () => {
    const original = FulmenError.fromError(new Error('test'), {
      code: 'TEST',
      severity: 'low',
    });

    const wrapped = FulmenError.wrap(original, {
      severity: 'critical',
    });

    // Must validate against error-response schema
    const isValid = await FulmenError.validate(wrapped.data);
    expect(isValid).toBe(true);
  });

  /**
   * TEST 7: FulmenErrorData path (no instanceof)
   * Tests wrap() with plain FulmenErrorData objects
   */
  test('recomputes severity_level when wrapping FulmenErrorData', () => {
    const errorData: FulmenErrorData = {
      code: 'TEST',
      message: 'Test error',
      severity: 'low',
      severity_level: 1,
    };

    const wrapped = FulmenError.wrap(errorData, {
      severity: 'high',
    });

    expect(wrapped.data.severity).toBe('high');
    expect(wrapped.data.severity_level).toBe(3);
  });

  /**
   * TEST 8: Stale data rejection (paranoid test)
   * Ensures manually-set incorrect severity_level is fixed
   */
  test('does not allow manually-set incorrect severity_level to persist', () => {
    const errorData: FulmenErrorData = {
      code: 'TEST',
      message: 'Test error',
      severity: 'critical',
      severity_level: 0, // ❌ Deliberately wrong (critical should be 4)
    };

    const wrapped = FulmenError.wrap(errorData);

    // Must recompute from severity, not trust provided severity_level
    expect(wrapped.data.severity).toBe('critical');
    expect(wrapped.data.severity_level).toBe(4); // ✅ Fixed
  });

  /**
   * TEST 9: Default severity handling
   * Ensures default severity (medium/2) is applied correctly
   */
  test('applies default severity when none provided', () => {
    const errorData: FulmenErrorData = {
      code: 'TEST',
      message: 'Test error',
      // No severity provided
    };

    const wrapped = FulmenError.wrap(errorData);

    expect(wrapped.data.severity).toBe('medium');
    expect(wrapped.data.severity_level).toBe(2);
  });

  /**
   * TEST 10: Severity override consistency with existing error data
   * Ensures severity override works even when original has different level
   */
  test('overrides severity correctly even with stale original data', () => {
    // Create error data with intentionally mismatched severity/level
    const errorData: FulmenErrorData = {
      code: 'TEST',
      message: 'Test error',
      severity: 'low',
      severity_level: 1,
    };

    // Wrap with FulmenError instance (goes through instanceof path)
    const err1 = new FulmenError(errorData);
    const wrapped1 = FulmenError.wrap(err1, {
      severity: 'critical',
    });

    expect(wrapped1.data.severity).toBe('critical');
    expect(wrapped1.data.severity_level).toBe(4); // Recomputed

    // Wrap with plain data (goes through isFulmenErrorData path)
    const wrapped2 = FulmenError.wrap(errorData, {
      severity: 'critical',
    });

    expect(wrapped2.data.severity).toBe('critical');
    expect(wrapped2.data.severity_level).toBe(4); // Recomputed
  });
});

describe('FulmenError.fromError() - Severity Consistency', () => {
  /**
   * TEST 11: fromError() computes severity_level correctly
   */
  test('computes severity_level from severity option', () => {
    const err = new Error('test');

    for (const severity of ['info', 'low', 'medium', 'high', 'critical'] as const) {
      const fulmenErr = FulmenError.fromError(err, {
        code: 'TEST',
        severity,
      });

      expect(fulmenErr.data.severity).toBe(severity);
      expect(fulmenErr.data.severity_level).toBe(SEVERITY_LEVELS[severity]);
    }
  });

  /**
   * TEST 12: fromError() applies default severity
   */
  test('applies default severity (medium) when not provided', () => {
    const err = new Error('test');
    const fulmenErr = FulmenError.fromError(err, { code: 'TEST' });

    expect(fulmenErr.data.severity).toBe('medium');
    expect(fulmenErr.data.severity_level).toBe(2);
  });
});

describe('FulmenError.getSeverityLevel() - Method Consistency', () => {
  /**
   * TEST 13: getSeverityLevel() returns consistent value
   */
  test('returns value matching severity_level field', () => {
    for (const severity of ['info', 'low', 'medium', 'high', 'critical'] as const) {
      const err = FulmenError.fromError(new Error('test'), {
        code: 'TEST',
        severity,
      });

      expect(err.getSeverityLevel()).toBe(err.data.severity_level);
      expect(err.getSeverityLevel()).toBe(SEVERITY_LEVELS[severity]);
    }
  });

  /**
   * TEST 14: getSeverityLevel() handles missing severity
   */
  test('computes from severity when severity_level is undefined', () => {
    const errorData: FulmenErrorData = {
      code: 'TEST',
      message: 'Test',
      severity: 'high',
      // severity_level deliberately omitted
    };

    const err = new FulmenError(errorData);

    // getSeverityLevel() should compute from severity
    expect(err.getSeverityLevel()).toBe(3);
  });
});
