/**
 * Histogram tests - unit tests for Histogram metric with ADR-0007 bucket behavior
 */

import { describe, expect, test } from "vitest";
import { Histogram } from "../histogram.js";
import { DEFAULT_MS_BUCKETS } from "../taxonomy.js";

describe("Histogram", () => {
  test("initializes with zero values", () => {
    const histogram = new Histogram("config_load_ms");
    expect(histogram.getCount()).toBe(0);
    expect(histogram.getSum()).toBe(0);
    expect(histogram.getAverage()).toBe(0);
  });

  test("applies ADR-0007 default buckets for _ms metrics", () => {
    const histogram = new Histogram("config_load_ms");
    const summary = histogram.getSummary();

    expect(summary.buckets).toHaveLength(DEFAULT_MS_BUCKETS.length);
    expect(summary.buckets.map((b) => b.le)).toEqual(DEFAULT_MS_BUCKETS);
  });

  test("does not apply default buckets for non-_ms metrics", () => {
    const histogram = new Histogram("foundry_lookup_count");
    const summary = histogram.getSummary();

    expect(summary.buckets).toHaveLength(0);
  });

  test("accepts custom buckets", () => {
    const customBuckets = [10, 50, 100, 500];
    const histogram = new Histogram("config_load_ms", {
      buckets: customBuckets,
    });
    const summary = histogram.getSummary();

    expect(summary.buckets.map((b) => b.le)).toEqual(customBuckets);
  });

  test("records single observation", () => {
    const histogram = new Histogram("config_load_ms");
    histogram.observe(42);

    expect(histogram.getCount()).toBe(1);
    expect(histogram.getSum()).toBe(42);
    expect(histogram.getAverage()).toBe(42);
  });

  test("records multiple observations", () => {
    const histogram = new Histogram("config_load_ms");
    histogram.observe(10);
    histogram.observe(20);
    histogram.observe(30);

    expect(histogram.getCount()).toBe(3);
    expect(histogram.getSum()).toBe(60);
    expect(histogram.getAverage()).toBe(20);
  });

  test("cumulative bucket counts (OTLP-compatible)", () => {
    const histogram = new Histogram("config_load_ms", {
      buckets: [10, 50, 100],
    });

    histogram.observe(5); // In bucket 10
    histogram.observe(25); // In buckets 50, 100
    histogram.observe(75); // In bucket 100
    histogram.observe(150); // Above all buckets

    const summary = histogram.getSummary();

    // Cumulative counts: [1, 2, 3] (not [1, 1, 1])
    expect(summary.buckets[0]).toEqual({ le: 10, count: 1 }); // ≤10: 5
    expect(summary.buckets[1]).toEqual({ le: 50, count: 2 }); // ≤50: 5, 25
    expect(summary.buckets[2]).toEqual({ le: 100, count: 3 }); // ≤100: 5, 25, 75
  });

  test("handles observations at bucket boundaries", () => {
    const histogram = new Histogram("config_load_ms", {
      buckets: [10, 50, 100],
    });

    histogram.observe(10); // Exactly at boundary
    histogram.observe(50); // Exactly at boundary
    histogram.observe(100); // Exactly at boundary

    const summary = histogram.getSummary();

    // All should be in their respective buckets (≤ comparison)
    expect(summary.buckets[0].count).toBe(1); // ≤10
    expect(summary.buckets[1].count).toBe(2); // ≤50
    expect(summary.buckets[2].count).toBe(3); // ≤100
  });

  test("resets histogram to initial state", () => {
    const histogram = new Histogram("config_load_ms");
    histogram.observe(42);
    histogram.observe(100);

    expect(histogram.getCount()).toBe(2);

    histogram.reset();

    expect(histogram.getCount()).toBe(0);
    expect(histogram.getSum()).toBe(0);
    expect(histogram.getAverage()).toBe(0);

    const summary = histogram.getSummary();
    for (const bucket of summary.buckets) {
      expect(bucket.count).toBe(0);
    }
  });

  test("handles zero observations", () => {
    const histogram = new Histogram("config_load_ms");
    histogram.observe(0);

    expect(histogram.getCount()).toBe(1);
    expect(histogram.getSum()).toBe(0);
    expect(histogram.getAverage()).toBe(0);
  });

  test("handles negative observations", () => {
    const histogram = new Histogram("config_load_ms", {
      buckets: [-10, 0, 10],
    });

    histogram.observe(-5);
    histogram.observe(5);

    expect(histogram.getCount()).toBe(2);
    expect(histogram.getSum()).toBe(0);

    const summary = histogram.getSummary();
    expect(summary.buckets[0].count).toBe(0); // ≤-10
    expect(summary.buckets[1].count).toBe(1); // ≤0 (includes -5)
    expect(summary.buckets[2].count).toBe(2); // ≤10 (includes both)
  });

  test("handles floating point observations", () => {
    const histogram = new Histogram("config_load_ms");
    histogram.observe(Math.PI);
    histogram.observe(Math.E);

    expect(histogram.getCount()).toBe(2);
    expect(histogram.getSum()).toBeCloseTo(5.85987, 5);
    expect(histogram.getAverage()).toBeCloseTo(2.929935, 5);
  });

  test("sorts custom buckets", () => {
    const unsortedBuckets = [100, 10, 50];
    const histogram = new Histogram("config_load_ms", {
      buckets: unsortedBuckets,
    });
    const summary = histogram.getSummary();

    // Should be sorted in ascending order
    expect(summary.buckets.map((b) => b.le)).toEqual([10, 50, 100]);
  });

  test("handles large number of observations", () => {
    const histogram = new Histogram("config_load_ms");

    for (let i = 0; i < 1000; i++) {
      histogram.observe(i);
    }

    expect(histogram.getCount()).toBe(1000);
    expect(histogram.getSum()).toBe(499500); // Sum of 0..999
    expect(histogram.getAverage()).toBe(499.5);
  });
});
