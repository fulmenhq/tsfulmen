import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { multiHash, verify } from "../convenience.js";

// Readable import removed to satisfy lint/unused checks
async function* createAsyncIterable(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("Convenience Helpers", () => {
  describe("multiHash()", () => {
    it("should compute multiple hashes for string input", async () => {
      const input = "123456789";
      const result = await multiHash(input, [Algorithm.CRC32, Algorithm.SHA256]);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[Algorithm.CRC32]?.hex).toBe("cbf43926");
      // SHA256 of 123456789 is 15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225
      expect(result[Algorithm.SHA256]?.hex).toMatch(/^15e2b0d3/);
    });

    it("should deduplicate algorithms", async () => {
      const input = "123456789";
      const result = await multiHash(input, [Algorithm.CRC32, Algorithm.CRC32]);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result[Algorithm.CRC32]?.hex).toBe("cbf43926");
    });

    it("should support custom encoding for string input", async () => {
      // "test" in base64 is 0xdb, 0x7b, 0x2d
      // but "test" as string is 0x74, 0x65, 0x73, 0x74
      // We'll use hex for clarity. "616263" (hex) -> "abc" (utf8)
      // If we pass encoding='hex', multiHash should decode "616263" to bytes [0x61, 0x62, 0x63]
      const input = "616263";
      const result = await multiHash(input, [Algorithm.CRC32], "hex");
      // crc32("abc") = 352441c2
      // crc32("616263") = 6e04f729
      expect(result[Algorithm.CRC32]?.hex).toBe("352441c2");
    });

    it("should compute multiple hashes for streaming input", async () => {
      const stream = createAsyncIterable(["123", "456", "789"]);
      const result = await multiHash(stream, [Algorithm.CRC32, Algorithm.XXH3_128]);

      expect(result[Algorithm.CRC32]?.hex).toBe("cbf43926");
      // XXH3 of 123456789
      expect(result[Algorithm.XXH3_128]?.formatted).toBeTruthy();
    });

    it("should handle empty algorithm list", async () => {
      const result = await multiHash("test", []);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe("verify()", () => {
    it("should return true for matching checksum", async () => {
      const valid = await verify("123456789", "crc32:cbf43926");
      expect(valid).toBe(true);
    });

    it("should return false for mismatching checksum", async () => {
      const valid = await verify("123456789", "crc32:00000000");
      expect(valid).toBe(false);
    });

    it("should support encoding option", async () => {
      // Verify "abc" provided as hex string "616263"
      const valid = await verify("616263", "crc32:352441c2", "hex");
      expect(valid).toBe(true);
    });

    it("should throw for invalid checksum format", async () => {
      await expect(verify("test", "invalid")).rejects.toThrow();
    });

    it("should verify stream input", async () => {
      const stream = createAsyncIterable(["123", "456", "789"]);
      const valid = await verify(stream, "crc32:cbf43926");
      expect(valid).toBe(true);
    });
  });
});
