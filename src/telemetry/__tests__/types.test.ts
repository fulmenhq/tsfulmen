import { describe, expect, it } from 'vitest';
import {
  type HistogramSummary,
  isHistogramSummary,
  isValidMetricName,
  isValidMetricUnit,
  type MetricValue,
} from '../types.js';

describe('Type Guards', () => {
  describe('isHistogramSummary', () => {
    it('returns true for valid histogram summary', () => {
      const summary: HistogramSummary = {
        count: 10,
        sum: 500,
        buckets: [
          { le: 10, count: 2 },
          { le: 100, count: 8 },
          { le: 1000, count: 10 },
        ],
      };

      expect(isHistogramSummary(summary)).toBe(true);
    });

    it('returns false for scalar number', () => {
      const value: MetricValue = 42;

      expect(isHistogramSummary(value)).toBe(false);
    });

    it('returns false for object missing count', () => {
      const invalid = {
        sum: 500,
        buckets: [],
      };

      expect(isHistogramSummary(invalid)).toBe(false);
    });

    it('returns false for object missing sum', () => {
      const invalid = {
        count: 10,
        buckets: [],
      };

      expect(isHistogramSummary(invalid)).toBe(false);
    });

    it('returns false for object missing buckets', () => {
      const invalid = {
        count: 10,
        sum: 500,
      };

      expect(isHistogramSummary(invalid)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isHistogramSummary(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isHistogramSummary(undefined)).toBe(false);
    });

    it('returns false for array', () => {
      expect(isHistogramSummary([1, 2, 3])).toBe(false);
    });

    it('returns false for string', () => {
      expect(isHistogramSummary('not a histogram')).toBe(false);
    });

    it('handles empty buckets array', () => {
      const summary: HistogramSummary = {
        count: 0,
        sum: 0,
        buckets: [],
      };

      expect(isHistogramSummary(summary)).toBe(true);
    });
  });

  describe('isValidMetricName', () => {
    it('returns true for valid metric names', () => {
      expect(isValidMetricName('schema_validations')).toBe(true);
      expect(isValidMetricName('schema_validation_errors')).toBe(true);
      expect(isValidMetricName('config_load_ms')).toBe(true);
      expect(isValidMetricName('config_load_errors')).toBe(true);
      expect(isValidMetricName('pathfinder_find_ms')).toBe(true);
      expect(isValidMetricName('pathfinder_validation_errors')).toBe(true);
      expect(isValidMetricName('pathfinder_security_warnings')).toBe(true);
      expect(isValidMetricName('foundry_lookup_count')).toBe(true);
      expect(isValidMetricName('logging_emit_count')).toBe(true);
      expect(isValidMetricName('logging_emit_latency_ms')).toBe(true);
      expect(isValidMetricName('goneat_command_duration_ms')).toBe(true);
    });

    it('returns false for invalid metric names', () => {
      expect(isValidMetricName('unknown_metric')).toBe(false);
      expect(isValidMetricName('invalid')).toBe(false);
      expect(isValidMetricName('')).toBe(false);
      expect(isValidMetricName('schema_validation')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isValidMetricName(42 as unknown as string)).toBe(false);
      expect(isValidMetricName(null as unknown as string)).toBe(false);
      expect(isValidMetricName(undefined as unknown as string)).toBe(false);
      expect(isValidMetricName({} as unknown as string)).toBe(false);
    });
  });

  describe('isValidMetricUnit', () => {
    it('returns true for valid metric units', () => {
      expect(isValidMetricUnit('count')).toBe(true);
      expect(isValidMetricUnit('ms')).toBe(true);
      expect(isValidMetricUnit('bytes')).toBe(true);
      expect(isValidMetricUnit('percent')).toBe(true);
    });

    it('returns false for invalid metric units', () => {
      expect(isValidMetricUnit('seconds')).toBe(false);
      expect(isValidMetricUnit('kb')).toBe(false);
      expect(isValidMetricUnit('')).toBe(false);
      expect(isValidMetricUnit('invalid')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isValidMetricUnit(42 as unknown as string)).toBe(false);
      expect(isValidMetricUnit(null as unknown as string)).toBe(false);
      expect(isValidMetricUnit(undefined as unknown as string)).toBe(false);
      expect(isValidMetricUnit({} as unknown as string)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('enables type narrowing for histogram summary', () => {
      const value: MetricValue = {
        count: 10,
        sum: 500,
        buckets: [],
      };

      if (isHistogramSummary(value)) {
        expect(value.count).toBe(10);
        expect(value.sum).toBe(500);
        expect(value.buckets).toEqual([]);
      } else {
        expect.fail('Should have narrowed to HistogramSummary');
      }
    });

    it('enables type narrowing for scalar value', () => {
      const value: MetricValue = 42;

      if (isHistogramSummary(value)) {
        expect.fail('Should not narrow to HistogramSummary');
      } else {
        expect(value).toBe(42);
        expect(typeof value).toBe('number');
      }
    });
  });
});
