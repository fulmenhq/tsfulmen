import { describe, expect, it } from "vitest";
import { Algorithm } from "../../crucible/fulhash/types.js";
import { Digest } from "../digest.js";

describe("Digest Class", () => {
  describe("constructor", () => {
    it("should create digest with algorithm and bytes", () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.bytes).toBeInstanceOf(Array);
      expect(digest.bytes).toEqual([0xab, 0xcd, 0xef]);
    });

    it("should copy input bytes (defensive copy)", () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      bytes[0] = 0xff;

      expect(digest.bytes[0]).toBe(0x01);
    });
  });

  describe("hex property", () => {
    it("should return lowercase hex string", () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.hex).toBe("abcdef");
    });

    it("should pad single-digit hex values", () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x0f]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.hex).toBe("01020f");
    });

    it("should handle empty bytes", () => {
      const bytes = new Uint8Array([]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.hex).toBe("");
    });

    it("should handle full SHA-256 hash", () => {
      const bytes = new Uint8Array(32);
      bytes.fill(0xff);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.hex).toBe("f".repeat(64));
      expect(digest.hex.length).toBe(64);
    });
  });

  describe("formatted property", () => {
    it("should return algorithm:hex format for SHA-256", () => {
      const bytes = new Uint8Array([0xab, 0xcd, 0xef]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.formatted).toBe("sha256:abcdef");
    });

    it("should return algorithm:hex format for XXH3-128", () => {
      const bytes = new Uint8Array([0x12, 0x34]);
      const digest = new Digest(Algorithm.XXH3_128, bytes);

      expect(digest.formatted).toBe("xxh3-128:1234");
    });

    it("should match expected format pattern", () => {
      const bytes = new Uint8Array(32);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.formatted).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
  });

  describe("immutability", () => {
    it("should be frozen (immutable)", () => {
      const bytes = new Uint8Array([0x01]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(Object.isFrozen(digest)).toBe(true);
    });

    it("should not allow modification of algorithm", () => {
      const bytes = new Uint8Array([0x01]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(() => {
        (digest as { algorithm: Algorithm }).algorithm = Algorithm.XXH3_128;
      }).toThrow();
    });

    it("should return defensive copy of bytes (not allow mutation)", () => {
      const bytes = new Uint8Array([0xaa, 0xbb, 0xcc]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      const bytesRef1 = digest.bytes;
      const bytesRef2 = digest.bytes;

      expect(bytesRef1).not.toBe(bytesRef2);

      bytesRef1[0] = 0xff;

      expect(digest.bytes[0]).toBe(0xaa);
      expect(digest.hex).toBe("aabbcc");
    });

    it("should not be affected by mutation of input bytes after construction", () => {
      const bytes = new Uint8Array([0x11, 0x22, 0x33]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      bytes[0] = 0xff;

      expect(digest.bytes[0]).toBe(0x11);
      expect(digest.hex).toBe("112233");
    });
  });

  describe("toJSON", () => {
    it("should serialize to JSON object", () => {
      const bytes = new Uint8Array([0xab, 0xcd]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      const json = digest.toJSON();

      expect(json).toEqual({
        algorithm: "sha256",
        hex: "abcd",
        formatted: "sha256:abcd",
      });
    });

    it("should work with JSON.stringify", () => {
      const bytes = new Uint8Array([0x12, 0x34]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      const jsonString = JSON.stringify(digest);
      const parsed = JSON.parse(jsonString);

      expect(parsed.algorithm).toBe("sha256");
      expect(parsed.hex).toBe("1234");
      expect(parsed.formatted).toBe("sha256:1234");
    });
  });

  describe("toString", () => {
    it("should return formatted checksum string", () => {
      const bytes = new Uint8Array([0xaa, 0xbb]);
      const digest = new Digest(Algorithm.SHA256, bytes);

      expect(digest.toString()).toBe("sha256:aabb");
      expect(String(digest)).toBe("sha256:aabb");
    });
  });
});
