import { describe, expect, it } from "vitest";
import { hash } from "../hash.js";
import { createStreamHasher } from "../stream.js";
import { Algorithm } from "../types.js";

describe("Stream Hashing", () => {
  describe("SHA-256 Streaming", () => {
    it("should hash data in single update", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const result = hasher.update("Hello, World!").digest();

      expect(result.algorithm).toBe(Algorithm.SHA256);
      expect(result.hex).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    });

    it("should hash data in multiple updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const result = hasher.update("Hello, ").update("World!").digest();

      expect(result.hex).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    });

    it("should match block hash for same input", async () => {
      const blockResult = await hash("test data");
      const streamHasher = await createStreamHasher();
      const streamResult = streamHasher.update("test data").digest();

      expect(streamResult.hex).toBe(blockResult.hex);
      expect(streamResult.formatted).toBe(blockResult.formatted);
    });

    it("should handle empty input", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const result = hasher.update("").digest();

      expect(result.hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should handle byte arrays", async () => {
      const data = new TextEncoder().encode("binary data");
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const result = hasher.update(data).digest();

      expect(result.hex).toBeTruthy();
      expect(result.bytes.length).toBe(32);
    });

    it("should support chaining updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const result = hasher.update("part1").update("part2").update("part3").digest();

      const expected = await hash("part1part2part3", {
        algorithm: Algorithm.SHA256,
      });
      expect(result.hex).toBe(expected.hex);
    });
  });

  describe("XXH3-128 Streaming", () => {
    it("should hash data in single update", async () => {
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const result = hasher.update("test data").digest();

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
      expect(result.hex).toBe("f012c3aaa2168e2f884ceb29fc98cdfd");
      expect(result.hex.length).toBe(32);
    });

    it("should hash data in multiple updates", async () => {
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const result = hasher.update("test ").update("data").digest();

      expect(result.hex).toBe("f012c3aaa2168e2f884ceb29fc98cdfd");
    });

    it("should match block hash for same input", async () => {
      const blockResult = await hash("streaming test", {
        algorithm: Algorithm.XXH3_128,
      });
      const streamHasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const streamResult = streamHasher.update("streaming test").digest();

      expect(streamResult.hex).toBe(blockResult.hex);
      expect(streamResult.formatted).toBe(blockResult.formatted);
    });

    it("should handle byte arrays", async () => {
      const data = new TextEncoder().encode("binary data");
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const result = hasher.update(data).digest();

      expect(result.hex).toBeTruthy();
      expect(result.bytes.length).toBe(16);
    });

    it("should support chaining updates", async () => {
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });
      const result = hasher.update("chunk1").update("chunk2").update("chunk3").digest();

      const expected = await hash("chunk1chunk2chunk3", {
        algorithm: Algorithm.XXH3_128,
      });
      expect(result.hex).toBe(expected.hex);
    });
  });

  describe("Stream Hasher Reset", () => {
    it("should allow reuse after reset (SHA-256)", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      const result1 = hasher.update("first").digest();
      hasher.reset();
      const result2 = hasher.update("first").digest();

      expect(result2.hex).toBe(result1.hex);
    });

    it("should allow reuse after reset (XXH3-128)", async () => {
      const hasher = await createStreamHasher({
        algorithm: Algorithm.XXH3_128,
      });

      const result1 = hasher.update("first").digest();
      hasher.reset();
      const result2 = hasher.update("first").digest();

      expect(result2.hex).toBe(result1.hex);
    });

    it("should produce different hash for different data after reset", async () => {
      const hasher = await createStreamHasher();

      const result1 = hasher.update("data1").digest();
      hasher.reset();
      const result2 = hasher.update("data2").digest();

      expect(result2.hex).not.toBe(result1.hex);
    });

    it("should allow multiple reset cycles", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });

      for (let i = 0; i < 5; i++) {
        const result = hasher.update(`iteration-${i}`).digest();
        expect(result.hex).toBeTruthy();
        hasher.reset();
      }
    });
  });

  describe("Stream Hasher State Management", () => {
    it("should throw when updating after digest", async () => {
      const hasher = await createStreamHasher();
      hasher.update("data").digest();

      expect(() => hasher.update("more")).toThrow("Cannot update after digest");
    });

    it("should throw when digesting twice without reset", async () => {
      const hasher = await createStreamHasher();
      hasher.update("data").digest();

      expect(() => hasher.digest()).toThrow();
    });

    it("should allow update after reset", async () => {
      const hasher = await createStreamHasher();
      hasher.update("data").digest();
      hasher.reset();

      expect(() => hasher.update("new data")).not.toThrow();
    });
  });

  describe("Mixed String and Binary Updates", () => {
    it("should handle alternating string and binary updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.SHA256 });
      const bytes = new TextEncoder().encode("binary");

      hasher.update("string1").update(bytes).update("string2");

      const result = hasher.digest();
      expect(result.hex).toBeTruthy();
    });
  });

  describe("Default Algorithm", () => {
    it("should default to XXH3-128", async () => {
      const hasher = await createStreamHasher();
      const result = hasher.update("test").digest();

      expect(result.algorithm).toBe(Algorithm.XXH3_128);
    });
  });
});
