import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { multiHash, verify } from "../convenience.js";

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
      expect(result[Algorithm.CRC32].hex).toBe("cbf43926");
      // SHA256 of 123456789 is 15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225
      expect(result[Algorithm.SHA256].hex).toMatch(/^15e2b0d3/);
    });

    it("should compute multiple hashes for streaming input", async () => {
      const stream = createAsyncIterable(["123", "456", "789"]);
      const result = await multiHash(stream, [Algorithm.CRC32, Algorithm.XXH3_128]);

      expect(result[Algorithm.CRC32].hex).toBe("cbf43926");
      // XXH3 of 123456789
      expect(result[Algorithm.XXH3_128].formatted).toBeTruthy();
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
