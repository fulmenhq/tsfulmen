import { describe, expect, it } from "vitest";
import { createStreamHasher } from "../stream.js";
import { Algorithm } from "../types.js";

describe("Stream Hasher Concurrency Safety", () => {
  describe("Concurrent Stream Hashers (Isolation)", () => {
    it("should handle multiple concurrent stream hashers correctly", async () => {
      const hasher1 = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const hasher2 = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const hasher3 = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });

      hasher1.update("data-1");
      hasher2.update("data-2");
      hasher3.update("data-3");

      const result1 = hasher1.digest();
      const result2 = hasher2.digest();
      const result3 = hasher3.digest();

      expect(result1.hex).not.toBe(result2.hex);
      expect(result2.hex).not.toBe(result3.hex);
      expect(result1.hex).not.toBe(result3.hex);
    });

    it("should maintain independent state across concurrent hashers", async () => {
      const inputs = ["test-a", "test-b", "test-c", "test-d", "test-e"];

      const hashers = await Promise.all(
        inputs.map(() => createStreamHasher({ algorithm: Algorithm.SHA256 })),
      );

      inputs.forEach((input, i) => {
        hashers[i].update(input);
      });

      const results = hashers.map((hasher) => hasher.digest());

      const hexes = results.map((r) => r.hex);
      const uniqueHexes = new Set(hexes);

      expect(uniqueHexes.size).toBe(inputs.length);
    });
  });

  describe("Concurrent Updates on Same Hasher (Sequential)", () => {
    it("should handle sequential updates correctly", async () => {
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });

      hasher.update("chunk1");
      hasher.update("chunk2");
      hasher.update("chunk3");

      const result = hasher.digest();

      expect(result.hex).toBeTruthy();
      expect(result.hex.length).toBe(32);
    });

    it("should match expected hash after multiple updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      hasher.update("Hello, ");
      hasher.update("World!");

      const result = hasher.digest();
      expect(result.hex).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    });
  });

  describe("Concurrent Factory Calls", () => {
    it("should create independent hashers concurrently", async () => {
      const promises = Array.from({ length: 10 }, () =>
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
      );

      const hashers = await Promise.all(promises);

      hashers.forEach((hasher, i) => {
        hasher.update(`unique-${i}`);
      });

      const results = hashers.map((hasher) => hasher.digest());
      const hexes = results.map((r) => r.hex);
      const uniqueHexes = new Set(hexes);

      expect(uniqueHexes.size).toBe(10);
    });

    it("should handle high concurrency factory calls", async () => {
      const count = 50;
      const promises = Array.from({ length: count }, () =>
        createStreamHasher({ algorithm: Algorithm.SHA256 }),
      );

      const hashers = await Promise.all(promises);

      expect(hashers.length).toBe(count);

      hashers.forEach((hasher) => {
        const result = hasher.update("test").digest();
        expect(result.algorithm).toBe(Algorithm.SHA256);
      });
    });
  });

  describe("Reset and Reuse Under Concurrency", () => {
    it("should allow concurrent resets on different hashers", async () => {
      const hasher1 = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const hasher2 = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      hasher1.update("data1").digest();
      hasher2.update("data2").digest();

      hasher1.reset();
      hasher2.reset();

      const result1 = hasher1.update("new1").digest();
      const result2 = hasher2.update("new2").digest();

      expect(result1.hex).not.toBe(result2.hex);
    });

    it("should handle multiple hashers with reset cycles", async () => {
      const hashers = await Promise.all([
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
      ]);

      for (let cycle = 0; cycle < 5; cycle++) {
        hashers.forEach((hasher, i) => {
          hasher.update(`cycle-${cycle}-hasher-${i}`);
        });

        const results = hashers.map((hasher) => hasher.digest());

        expect(results[0].hex).not.toBe(results[1].hex);
        expect(results[1].hex).not.toBe(results[2].hex);

        for (const hasher of hashers) {
          hasher.reset();
        }
      }
    });
  });

  describe("Interleaved Operations", () => {
    it("should handle interleaved updates on different hashers", async () => {
      const hasher1 = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const hasher2 = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      hasher1.update("a");
      hasher2.update("b");
      hasher1.update("c");
      hasher2.update("d");

      const result1 = hasher1.digest();
      const result2 = hasher2.digest();

      expect(result1.hex).not.toBe(result2.hex);

      hasher1.reset();
      hasher2.reset();

      const verify1 = hasher1.update("a").update("c").digest();
      const verify2 = hasher2.update("b").update("d").digest();

      expect(verify1.hex).toBe(result1.hex);
      expect(verify2.hex).toBe(result2.hex);
    });
  });

  describe("Mixed Algorithms Concurrently", () => {
    it("should handle concurrent hashers with different algorithms", async () => {
      const sha256Hasher = await createStreamHasher({
        algorithm: Algorithm.SHA256,
      });
      const xxh3Hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });

      sha256Hasher.update("test data");
      xxh3Hasher.update("test data");

      const sha256Result = sha256Hasher.digest();
      const xxh3Result = xxh3Hasher.digest();

      expect(sha256Result.algorithm).toBe(Algorithm.SHA256);
      expect(xxh3Result.algorithm).toBe(Algorithm.XXH3_128);
      expect(sha256Result.hex).not.toBe(xxh3Result.hex);
    });

    it("should handle many mixed algorithm hashers", async () => {
      const hashers = await Promise.all([
        createStreamHasher({ algorithm: Algorithm.SHA256 }),
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
        createStreamHasher({ algorithm: Algorithm.SHA256 }),
        createStreamHasher({ algorithm: Algorithm.XXH3_128 }),
        createStreamHasher({ algorithm: Algorithm.SHA256 }),
      ]);

      hashers.forEach((hasher, i) => {
        hasher.update(`data-${i}`);
      });

      const results = hashers.map((hasher) => hasher.digest());

      expect(results[0].algorithm).toBe(Algorithm.SHA256);
      expect(results[1].algorithm).toBe(Algorithm.XXH3_128);
      expect(results[2].algorithm).toBe(Algorithm.SHA256);
      expect(results[3].algorithm).toBe(Algorithm.XXH3_128);
      expect(results[4].algorithm).toBe(Algorithm.SHA256);
    });
  });
});
