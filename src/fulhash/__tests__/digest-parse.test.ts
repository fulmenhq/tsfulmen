import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { Digest } from "../digest.js";
import { InvalidChecksumError, InvalidChecksumFormatError } from "../errors.js";

describe("Digest", () => {
  describe("parse()", () => {
    it("should parse XXH3-128 digest", () => {
      const formatted = "xxh3-128:99aa06d3014798d86001c324468d497f";
      const digest = Digest.parse(formatted);
      expect(digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(digest.hex).toBe("99aa06d3014798d86001c324468d497f");
    });

    it("should parse SHA-256 digest", () => {
      const formatted = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const digest = Digest.parse(formatted);
      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should parse CRC32 digest", () => {
      const formatted = "crc32:cbf43926";
      const digest = Digest.parse(formatted);
      expect(digest.algorithm).toBe(Algorithm.CRC32);
      expect(digest.hex).toBe("cbf43926");
    });

    it("should parse CRC32C digest", () => {
      const formatted = "crc32c:e3069283";
      const digest = Digest.parse(formatted);
      expect(digest.algorithm).toBe(Algorithm.CRC32C);
      expect(digest.hex).toBe("e3069283");
    });

    it("should throw for invalid hex length (XXH3)", () => {
      expect(() => Digest.parse("xxh3-128:abc")).toThrow(InvalidChecksumError);
    });

    it("should throw for invalid hex length (CRC32)", () => {
      expect(() => Digest.parse("crc32:abcdef")).toThrow(InvalidChecksumError); // too short
      expect(() => Digest.parse("crc32:abcdef1234")).toThrow(InvalidChecksumError); // too long
    });

    it("should throw for missing separator", () => {
      expect(() => Digest.parse("invalid")).toThrow(InvalidChecksumFormatError);
    });
  });
});
