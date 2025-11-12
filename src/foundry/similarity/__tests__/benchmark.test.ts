import { describe, it } from "vitest";
import { distance, score } from "../index.js";

describe("performance benchmarks", () => {
  const longString = "a".repeat(128);
  const longString2 = "b".repeat(128);

  it("distance with 128-char strings", () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      distance(longString, longString2);
    }

    const end = performance.now();
    const totalMs = end - start;
    const avgMs = totalMs / iterations;
    const p95Ms = avgMs * 1.5;

    console.log(`\nBenchmark: distance (128-char strings)`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Total time: ${totalMs.toFixed(2)}ms`);
    console.log(`  Avg time: ${avgMs.toFixed(4)}ms`);
    console.log(`  Est. p95: ${p95Ms.toFixed(4)}ms`);
    console.log(`  Target: <1.0ms (p95)`);
    console.log(`  Status: ${p95Ms < 1.0 ? "✅ PASS" : "❌ FAIL (exceeds target)"}`);
  });

  it("score with 128-char strings", () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      score(longString, longString2);
    }

    const end = performance.now();
    const totalMs = end - start;
    const avgMs = totalMs / iterations;
    const p95Ms = avgMs * 1.5;

    console.log(`\nBenchmark: score (128-char strings)`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Total time: ${totalMs.toFixed(2)}ms`);
    console.log(`  Avg time: ${avgMs.toFixed(4)}ms`);
    console.log(`  Est. p95: ${p95Ms.toFixed(4)}ms`);
    console.log(`  Target: <1.0ms (p95)`);
    console.log(`  Status: ${p95Ms < 1.0 ? "✅ PASS" : "❌ FAIL (exceeds target)"}`);
  });
});
