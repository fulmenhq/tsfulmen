import { describe, expect, it } from 'vitest';
import { listAssets } from '../discovery.js';

describe('performance benchmarks', () => {
  it('full discovery across all categories completes in <250ms', async () => {
    const start = performance.now();

    await Promise.all([
      listAssets('docs'),
      listAssets('schemas'),
      listAssets('config'),
      listAssets('templates'),
    ]);

    const duration = performance.now() - start;

    console.log(
      `\nBenchmark: Full discovery (all categories)\n  Duration: ${duration.toFixed(2)}ms\n  Target: <250.0ms\n  Status: ${duration < 250 ? '✅ PASS' : '❌ FAIL'}`,
    );

    expect(duration).toBeLessThan(250);
  });

  it('individual category discovery completes quickly', async () => {
    const results: Array<{
      category: string;
      duration: number;
      count: number;
    }> = [];

    for (const category of ['docs', 'schemas', 'config'] as const) {
      const start = performance.now();
      const assets = await listAssets(category);
      const duration = performance.now() - start;

      results.push({ category, duration, count: assets.length });
    }

    console.log('\nBenchmark: Individual category discovery');
    for (const result of results) {
      console.log(`  ${result.category}: ${result.duration.toFixed(2)}ms (${result.count} assets)`);
    }

    expect(results.every((r) => r.duration < 100)).toBe(true);
  });
});
