import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32 } from "../base32.js";

describe("base32 encoding", () => {
  it("returns empty string for empty input", () => {
    const result = encodeBase32(new Uint8Array(0), "base32", { padding: true });
    expect(result).toBe("");
  });

  it("encodes single byte", () => {
    const result = encodeBase32(new Uint8Array([0x66]), "base32", { padding: true });
    // 'f' = 0x66 = 01100110 -> MY======
    expect(result).toBe("MY======");
  });

  it("encodes without padding", () => {
    const result = encodeBase32(new Uint8Array([0x66]), "base32", { padding: false });
    expect(result).toBe("MY");
    expect(result).not.toContain("=");
  });

  it("encodes base32hex variant", () => {
    const bytes = new TextEncoder().encode("foobar");
    const result = encodeBase32(bytes, "base32hex", { padding: true });
    expect(result).toBe("CPNMUOJ1E8======");
  });
});

describe("base32 decoding", () => {
  describe("padding validation", () => {
    it("throws on invalid padding - non-equals after padding", () => {
      // Padding character followed by non-padding character
      expect(() =>
        decodeBase32("MY====X=", "base32", {
          ignoreWhitespace: false,
          validatePadding: true,
        }),
      ).toThrow("Invalid base32 padding");
    });

    it("throws on invalid length with padding validation", () => {
      // Valid base32 with padding should be multiple of 8
      expect(() =>
        decodeBase32("MY===", "base32", {
          ignoreWhitespace: false,
          validatePadding: true,
        }),
      ).toThrow("Invalid base32 length (padding)");
    });

    it("allows invalid padding when validation disabled", () => {
      // Should not throw when validatePadding is false
      const result = decodeBase32("MY===", "base32", {
        ignoreWhitespace: false,
        validatePadding: false,
      });
      expect(result).toBeDefined();
    });
  });

  describe("invalid characters", () => {
    it("throws on invalid base32 character", () => {
      expect(() =>
        decodeBase32("MY1=====", "base32", {
          ignoreWhitespace: false,
          validatePadding: false,
        }),
      ).toThrow("Invalid base32 character: 1");
    });

    it("throws on invalid base32hex character", () => {
      // Z is not valid in base32hex (alphabet is 0-9A-V)
      expect(() =>
        decodeBase32("Z", "base32hex", {
          ignoreWhitespace: false,
          validatePadding: false,
        }),
      ).toThrow("Invalid base32 character: Z");
    });
  });

  describe("whitespace handling", () => {
    it("ignores whitespace when enabled", () => {
      const result = decodeBase32("MZ XW\n6Y\tTB", "base32", {
        ignoreWhitespace: true,
        validatePadding: false,
      });
      // MZXW6YTB decodes to "fooba"
      expect(new TextDecoder().decode(result)).toBe("fooba");
    });

    it("case insensitive decoding", () => {
      const upper = decodeBase32("MZXW6YTBOI", "base32", {
        ignoreWhitespace: false,
        validatePadding: false,
      });
      const lower = decodeBase32("mzxw6ytboi", "base32", {
        ignoreWhitespace: false,
        validatePadding: false,
      });
      expect(Array.from(upper)).toEqual(Array.from(lower));
    });
  });

  describe("RFC4648 test vectors", () => {
    const testVectors = [
      { input: "", encoded: "" },
      { input: "f", encoded: "MY======" },
      { input: "fo", encoded: "MZXQ====" },
      { input: "foo", encoded: "MZXW6===" },
      { input: "foob", encoded: "MZXW6YQ=" },
      { input: "fooba", encoded: "MZXW6YTB" },
      { input: "foobar", encoded: "MZXW6YTBOI======" },
    ];

    for (const { input, encoded } of testVectors) {
      it(`round-trips "${input}"`, () => {
        const bytes = new TextEncoder().encode(input);
        const encodedResult = encodeBase32(bytes, "base32", { padding: true });
        expect(encodedResult).toBe(encoded);

        if (encoded) {
          const decoded = decodeBase32(encoded, "base32", {
            ignoreWhitespace: false,
            validatePadding: true,
          });
          expect(new TextDecoder().decode(decoded)).toBe(input);
        }
      });
    }
  });
});
