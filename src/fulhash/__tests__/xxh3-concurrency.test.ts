import { describe, expect, it } from 'vitest';
import * as xxh3 from '../algorithms/xxh3.js';
import { hash, hashBytes } from '../hash.js';
import { Algorithm } from '../types.js';

describe('XXH3-128 Concurrency Safety', () => {
  it('should handle concurrent hash() calls correctly', async () => {
    const inputs = ['test-data-1', 'test-data-2', 'test-data-3', 'test-data-4', 'test-data-5'];

    const expectedResults = await Promise.all(
      inputs.map((input) => hash(input, { algorithm: Algorithm.XXH3_128 })),
    );

    const expectedHexes = expectedResults.map((r) => r.hex);

    for (let iteration = 0; iteration < 10; iteration++) {
      const concurrentResults = await Promise.all(
        inputs.map((input) => hash(input, { algorithm: Algorithm.XXH3_128 })),
      );

      const concurrentHexes = concurrentResults.map((r) => r.hex);

      for (let i = 0; i < inputs.length; i++) {
        expect(concurrentHexes[i]).toBe(expectedHexes[i]);
      }
    }
  });

  it('should handle concurrent hashBytes() calls with different data', async () => {
    const data1 = new TextEncoder().encode('concurrent-test-1');
    const data2 = new TextEncoder().encode('concurrent-test-2');
    const data3 = new TextEncoder().encode('concurrent-test-3');

    const expected1 = await hashBytes(data1, { algorithm: Algorithm.XXH3_128 });
    const expected2 = await hashBytes(data2, { algorithm: Algorithm.XXH3_128 });
    const expected3 = await hashBytes(data3, { algorithm: Algorithm.XXH3_128 });

    for (let i = 0; i < 20; i++) {
      const [result1, result2, result3] = await Promise.all([
        hashBytes(data1, { algorithm: Algorithm.XXH3_128 }),
        hashBytes(data2, { algorithm: Algorithm.XXH3_128 }),
        hashBytes(data3, { algorithm: Algorithm.XXH3_128 }),
      ]);

      expect(result1.hex).toBe(expected1.hex);
      expect(result2.hex).toBe(expected2.hex);
      expect(result3.hex).toBe(expected3.hex);
    }
  });

  it('should produce deterministic results under high concurrency', async () => {
    const testInput = 'deterministic-test';
    const expected = await hash(testInput, { algorithm: Algorithm.XXH3_128 });

    const concurrentCount = 50;
    const promises = Array.from({ length: concurrentCount }, () =>
      hash(testInput, { algorithm: Algorithm.XXH3_128 }),
    );

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.hex).toBe(expected.hex);
    }
  });

  it('should not mix data between concurrent operations', async () => {
    const inputs = Array.from({ length: 100 }, (_, i) => `test-${i}`);

    const sequentialResults = new Map<string, string>();
    for (const input of inputs) {
      const result = await hash(input, { algorithm: Algorithm.XXH3_128 });
      sequentialResults.set(input, result.hex);
    }

    const concurrentResults = await Promise.all(
      inputs.map(async (input) => {
        const result = await hash(input, { algorithm: Algorithm.XXH3_128 });
        return { input, hex: result.hex };
      }),
    );

    for (const { input, hex } of concurrentResults) {
      expect(hex).toBe(sequentialResults.get(input));
    }
  });

  it('should handle interleaved operations correctly', async () => {
    const input1 = 'interleaved-1';
    const input2 = 'interleaved-2';

    const expected1 = await hash(input1, { algorithm: Algorithm.XXH3_128 });
    const expected2 = await hash(input2, { algorithm: Algorithm.XXH3_128 });

    for (let i = 0; i < 10; i++) {
      const promise1 = hash(input1, { algorithm: Algorithm.XXH3_128 });
      const promise2 = hash(input2, { algorithm: Algorithm.XXH3_128 });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.hex).toBe(expected1.hex);
      expect(result2.hex).toBe(expected2.hex);
    }
  });

  it('should handle direct algorithm access with race conditions', async () => {
    const data1 = new TextEncoder().encode('race-test-1');
    const data2 = new TextEncoder().encode('race-test-2');

    const expected1Hex = (await xxh3.hashBytes(data1)).reduce(
      (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
      '',
    );
    const expected2Hex = (await xxh3.hashBytes(data2)).reduce(
      (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
      '',
    );

    for (let i = 0; i < 50; i++) {
      const [result1, result2] = await Promise.all([xxh3.hashBytes(data1), xxh3.hashBytes(data2)]);

      const result1Hex = result1.reduce(
        (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
        '',
      );
      const result2Hex = result2.reduce(
        (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
        '',
      );

      expect(result1Hex).toBe(expected1Hex);
      expect(result2Hex).toBe(expected2Hex);
    }
  });
});
