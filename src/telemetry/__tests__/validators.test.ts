import { beforeEach, describe, expect, it } from 'vitest';
import type { HistogramSummary, MetricsEvent } from '../types.js';
import {
  assertValidMetricsEvent,
  formatValidationErrors,
  getValidationErrors,
  MetricsValidator,
  validateMetricsEvent,
  validateMetricsEvents,
} from '../validators.js';

describe('Validators', () => {
  beforeEach(() => {
    MetricsValidator._reset();
  });

  describe('validateMetricsEvent', () => {
    it('validates valid counter event', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
        unit: 'count',
      };

      expect(await validateMetricsEvent(event)).toBe(true);
    });

    it('validates valid gauge event', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'foundry_lookup_count',
        value: -10,
        unit: 'count',
      };

      expect(await validateMetricsEvent(event)).toBe(true);
    });

    it('validates valid histogram event', async () => {
      const histogramValue: HistogramSummary = {
        count: 2,
        sum: 150,
        buckets: [
          { le: 10, count: 0 },
          { le: 100, count: 1 },
          { le: 1000, count: 2 },
        ],
      };

      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'config_load_ms',
        value: histogramValue,
        unit: 'ms',
      };

      expect(await validateMetricsEvent(event)).toBe(true);
    });

    it('rejects event with missing required fields', async () => {
      const invalidEvent = {
        timestamp: new Date().toISOString(),
        value: 42,
      };

      expect(await validateMetricsEvent(invalidEvent)).toBe(false);
    });

    it('rejects event with invalid timestamp', async () => {
      const invalidEvent = {
        timestamp: 'not-a-timestamp',
        name: 'schema_validations',
        value: 42,
      };

      expect(await validateMetricsEvent(invalidEvent)).toBe(false);
    });

    it('validates event without optional unit field', async () => {
      const event = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
      };

      expect(await validateMetricsEvent(event)).toBe(true);
    });

    it('validates event with tags', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
        unit: 'count',
        tags: {
          environment: 'test',
          service: 'tsfulmen',
        },
      };

      expect(await validateMetricsEvent(event)).toBe(true);
    });
  });

  describe('validateMetricsEvents', () => {
    it('validates array of valid events', async () => {
      const events: MetricsEvent[] = [
        {
          timestamp: new Date().toISOString(),
          name: 'schema_validations',
          value: 42,
          unit: 'count',
        },
        {
          timestamp: new Date().toISOString(),
          name: 'config_load_ms',
          value: 100,
          unit: 'ms',
        },
      ];

      expect(await validateMetricsEvents(events)).toBe(true);
    });

    it('rejects if any event is invalid', async () => {
      const events = [
        {
          timestamp: new Date().toISOString(),
          name: 'schema_validations',
          value: 42,
        },
        {
          timestamp: 'invalid',
          name: 'config_load_ms',
          value: 100,
        },
      ];

      expect(await validateMetricsEvents(events)).toBe(false);
    });

    it('handles empty array', async () => {
      expect(await validateMetricsEvents([])).toBe(true);
    });
  });

  describe('getValidationErrors', () => {
    it('returns errors after failed validation', async () => {
      const invalidEvent = {
        timestamp: new Date().toISOString(),
        value: 42,
      };

      await validateMetricsEvent(invalidEvent);
      const errors = getValidationErrors();

      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('returns null before any validation', () => {
      const errors = getValidationErrors();

      expect(errors).toBeNull();
    });

    it('returns null after successful validation', async () => {
      const validEvent: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
      };

      await validateMetricsEvent(validEvent);
      const errors = getValidationErrors();

      expect(errors).toBeNull();
    });
  });

  describe('formatValidationErrors', () => {
    it('formats errors with path and message', () => {
      const errors = [
        { instancePath: '/name', message: 'is required' },
        { instancePath: '/timestamp', message: 'must be string' },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('/name: is required');
      expect(formatted).toContain('/timestamp: must be string');
    });

    it('handles errors without path', () => {
      const errors = [{ message: 'validation failed' }];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('(root): validation failed');
    });

    it('handles errors without message', () => {
      const errors = [{ instancePath: '/value' }];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain('/value: validation failed');
    });

    it('joins multiple errors with semicolon', () => {
      const errors = [
        { instancePath: '/name', message: 'error 1' },
        { instancePath: '/value', message: 'error 2' },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toBe('/name: error 1; /value: error 2');
    });
  });

  describe('assertValidMetricsEvent', () => {
    it('does not throw for valid event', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
      };

      await expect(assertValidMetricsEvent(event)).resolves.toBeUndefined();
    });

    it('throws for invalid event', async () => {
      const invalidEvent = {
        timestamp: new Date().toISOString(),
        value: 42,
      };

      await expect(assertValidMetricsEvent(invalidEvent)).rejects.toThrow('Invalid metrics event');
    });

    it('includes formatted errors in exception', async () => {
      const invalidEvent = {
        timestamp: new Date().toISOString(),
        value: 42,
      };

      try {
        await assertValidMetricsEvent(invalidEvent);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err instanceof Error).toBe(true);
        expect((err as Error).message).toContain('Invalid metrics event');
      }
    });
  });

  describe('singleton behavior', () => {
    it('reuses compiled validator', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
      };

      const result1 = await validateMetricsEvent(event);
      const result2 = await validateMetricsEvent(event);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('handles concurrent validation calls', async () => {
      const event: MetricsEvent = {
        timestamp: new Date().toISOString(),
        name: 'schema_validations',
        value: 42,
      };

      const results = await Promise.all([
        validateMetricsEvent(event),
        validateMetricsEvent(event),
        validateMetricsEvent(event),
      ]);

      expect(results).toEqual([true, true, true]);
    });
  });
});
