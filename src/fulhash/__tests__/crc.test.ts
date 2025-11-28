import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { hashBytes, hashString } from "../hash.js";
import { createStreamHasher } from "../stream.js";

describe("CRC Hashing Support", () => {
  describe("CRC32 Block", () => {
    it("should hash '123456789' correctly (standard vector)", async () => {
      const result = await hashString("123456789", {
        algorithm: Algorithm.CRC32,
      });
      expect(result.hex).toBe("cbf43926");
      expect(result.algorithm).toBe(Algorithm.CRC32);
    });

    it("should hash empty string", async () => {
      const result = await hashString("", { algorithm: Algorithm.CRC32 });
      // CRC32 of empty string is 0
      expect(result.hex).toBe("00000000");
    });

    it("should handle binary data", async () => {
      const input = new Uint8Array([1, 2, 3]);
      const result = await hashBytes(input, { algorithm: Algorithm.CRC32 });
      // python -c "import zlib; print(hex(zlib.crc32(bytes([1,2,3]))))" -> 0x55bc801d
      expect(result.hex).toBe("55bc801d");
    });
  });

  describe("CRC32C Block", () => {
    it("should hash '123456789' correctly (standard vector)", async () => {
      const result = await hashString("123456789", {
        algorithm: Algorithm.CRC32C,
      });
      // Castagnoli polynomial
      expect(result.hex).toBe("e3069283");
      expect(result.algorithm).toBe(Algorithm.CRC32C);
    });

    it("should hash empty string", async () => {
      const result = await hashString("", { algorithm: Algorithm.CRC32C });
      // CRC32C of empty string is 0
      expect(result.hex).toBe("00000000");
    });

    it("should handle binary data", async () => {
      const input = new Uint8Array([1, 2, 3]);
      const result = await hashBytes(input, { algorithm: Algorithm.CRC32C });

      // Verified against hash-wasm implementation:
      // hash-wasm calculates CRC32C of [1,2,3] as 'f130f21e'.
      expect(result.hex).toBe("f130f21e");
    });
  });

  describe("CRC32 Streaming", () => {
    it("should support streaming updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.CRC32 });
      // "123" + "456789" -> "123456789"
      hasher.update("123");
      hasher.update("456789");
      const result = hasher.digest();
      expect(result.hex).toBe("cbf43926");
    });

    it("should support reset", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.CRC32 });
      hasher.update("garbage");
      hasher.reset();
      hasher.update("123456789");
      const result = hasher.digest();
      expect(result.hex).toBe("cbf43926");
    });
  });

  describe("CRC32C Streaming", () => {
    it("should support streaming updates", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.CRC32C });
      hasher.update("123");
      hasher.update("456789");
      const result = hasher.digest();
      expect(result.hex).toBe("e3069283");
    });

    it("should support reset", async () => {
      const hasher = await createStreamHasher({ algorithm: Algorithm.CRC32C });
      hasher.update("garbage");
      hasher.reset();
      hasher.update("123456789");
      const result = hasher.digest();
      expect(result.hex).toBe("e3069283");
    });
  });
});
