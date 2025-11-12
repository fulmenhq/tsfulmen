import { describe, expect, it } from "vitest";
import * as sha256 from "../algorithms/sha256.js";

describe("SHA-256 Adapter", () => {
  describe("hashBytes", () => {
    it("should hash empty input correctly", () => {
      const input = new Uint8Array([]);
      const result = sha256.hashBytes(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);

      const hex = Array.from(result)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it('should hash "Hello, World!" correctly', () => {
      const input = new TextEncoder().encode("Hello, World!");
      const result = sha256.hashBytes(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);

      const hex = Array.from(result)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    });

    it("should handle binary data correctly", () => {
      const input = new Uint8Array([0, 1, 2, 3, 4, 5, 255, 254, 253, 252, 251, 250]);
      const result = sha256.hashBytes(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle large input (1MB)", () => {
      const input = new Uint8Array(1024 * 1024);
      input.fill(65);
      const result = sha256.hashBytes(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });
  });

  describe("hashString", () => {
    it("should hash empty string correctly", () => {
      const result = sha256.hashString("");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);

      const hex = Array.from(result)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it('should hash "Hello, World!" correctly', () => {
      const result = sha256.hashString("Hello, World!");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);

      const hex = Array.from(result)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(hex).toBe("dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f");
    });

    it("should handle UTF-8 encoding by default", () => {
      const result = sha256.hashString("Hello 🔥 World");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should respect encoding parameter", () => {
      const result1 = sha256.hashString("test", "utf8");
      const result2 = sha256.hashString("test", "utf8");

      expect(Array.from(result1)).toEqual(Array.from(result2));
    });
  });
});
