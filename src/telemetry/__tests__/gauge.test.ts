/**
 * Gauge tests - unit tests for Gauge metric
 */

import { describe, expect, test } from "vitest";
import { Gauge } from "../gauge.js";

describe("Gauge", () => {
  test("initializes with zero value", () => {
    const gauge = new Gauge("foundry_lookup_count");
    expect(gauge.getValue()).toBe(0);
    expect(gauge.name).toBe("foundry_lookup_count");
  });

  test("sets value", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(42);
    expect(gauge.getValue()).toBe(42);
  });

  test("allows negative values", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(-10);
    expect(gauge.getValue()).toBe(-10);
  });

  test("increments by 1 when no delta provided", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.inc();
    expect(gauge.getValue()).toBe(1);
  });

  test("increments by specified delta", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.inc(5);
    expect(gauge.getValue()).toBe(5);
    gauge.inc(3);
    expect(gauge.getValue()).toBe(8);
  });

  test("decrements by 1 when no delta provided", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(10);
    gauge.dec();
    expect(gauge.getValue()).toBe(9);
  });

  test("decrements by specified delta", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(10);
    gauge.dec(3);
    expect(gauge.getValue()).toBe(7);
  });

  test("allows increment with negative delta", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(10);
    gauge.inc(-5);
    expect(gauge.getValue()).toBe(5);
  });

  test("allows decrement with negative delta", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(10);
    gauge.dec(-5);
    expect(gauge.getValue()).toBe(15);
  });

  test("resets to zero", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(42);
    expect(gauge.getValue()).toBe(42);
    gauge.reset();
    expect(gauge.getValue()).toBe(0);
  });

  test("handles zero value", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(10);
    gauge.set(0);
    expect(gauge.getValue()).toBe(0);
  });

  test("handles floating point values", () => {
    const gauge = new Gauge("foundry_lookup_count");
    gauge.set(Math.PI);
    expect(gauge.getValue()).toBe(Math.PI);
  });
});
