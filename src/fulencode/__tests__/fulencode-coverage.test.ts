import { describe, expect, it } from "vitest";
import { EncodingFormat, FulencodeError, fulencode } from "../index.js";

describe("fulencode encode coverage", () => {
  describe("line wrapping (wrapLines)", () => {
    it("wraps base64 output at specified line length", async () => {
      const data = new Uint8Array(100);
      for (let i = 0; i < data.length; i++) data[i] = i;

      const encoded = await fulencode.encode(data, EncodingFormat.BASE64, {
        lineLength: 20,
      });

      const lines = encoded.data.split("\n");
      expect(lines.length).toBeGreaterThan(1);
      // All lines except the last should be exactly 20 chars
      for (let i = 0; i < lines.length - 1; i++) {
        expect(lines[i].length).toBe(20);
      }
    });

    it("uses CRLF line ending when specified", async () => {
      const data = new Uint8Array(100);
      for (let i = 0; i < data.length; i++) data[i] = i;

      const encoded = await fulencode.encode(data, EncodingFormat.BASE64, {
        lineLength: 20,
        lineEnding: "\r\n",
      });

      expect(encoded.data).toContain("\r\n");
      expect(encoded.data.split("\r\n").length).toBeGreaterThan(1);
    });

    it("does not wrap when lineLength is 0", async () => {
      const data = new Uint8Array(100);
      const encoded = await fulencode.encode(data, EncodingFormat.BASE64, {
        lineLength: 0,
      });

      expect(encoded.data).not.toContain("\n");
    });
  });

  describe("maxEncodedSize limit", () => {
    it("throws when encoded output exceeds maxEncodedSize", async () => {
      const data = new Uint8Array(100);

      await expect(
        fulencode.encode(data, EncodingFormat.BASE64, {
          maxEncodedSize: 10,
        }),
      ).rejects.toThrow(FulencodeError);

      try {
        await fulencode.encode(data, EncodingFormat.BASE64, {
          maxEncodedSize: 10,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(FulencodeError);
        const err = e as FulencodeError;
        expect(err.code).toBe("OUTPUT_TOO_LARGE");
        expect(err.operation).toBe("encode");
        expect(err.details?.maxEncodedSize).toBe(10);
      }
    });
  });

  describe("embedChecksum option", () => {
    it("throws UNSUPPORTED_FEATURE for embedChecksum", async () => {
      const data = new Uint8Array([1, 2, 3]);

      await expect(
        fulencode.encode(data, EncodingFormat.BASE64, {
          embedChecksum: true,
        }),
      ).rejects.toThrow(FulencodeError);

      try {
        await fulencode.encode(data, EncodingFormat.BASE64, {
          embedChecksum: true,
        });
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("UNSUPPORTED_FEATURE");
        expect(err.message).toContain("embedChecksum");
      }
    });
  });

  describe("computeChecksum option", () => {
    it("computes sha256 checksum on encode", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const result = await fulencode.encode(data, EncodingFormat.BASE64, {
        computeChecksum: "sha256",
      });

      expect(result.checksum).toBeDefined();
      expect(result.checksumAlgorithm).toBe("sha256");
      expect(typeof result.checksum).toBe("string");
    });

    it("computes xxh3-128 checksum on encode", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const result = await fulencode.encode(data, EncodingFormat.BASE64, {
        computeChecksum: "xxh3-128",
      });

      expect(result.checksum).toBeDefined();
      expect(result.checksumAlgorithm).toBe("xxh3-128");
    });

    it("throws for unsupported checksum algorithm", async () => {
      const data = new Uint8Array([1, 2, 3]);

      await expect(
        fulencode.encode(data, EncodingFormat.BASE64, {
          computeChecksum: "md5",
        }),
      ).rejects.toThrow(FulencodeError);

      try {
        await fulencode.encode(data, EncodingFormat.BASE64, {
          computeChecksum: "md5",
        });
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("UNSUPPORTED_CHECKSUM");
      }
    });
  });

  describe("requireBytes (string input to binary format)", () => {
    it("throws when encoding string as base64", async () => {
      await expect(fulencode.encode("hello", EncodingFormat.BASE64)).rejects.toThrow(FulencodeError);

      try {
        await fulencode.encode("hello", EncodingFormat.BASE64);
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("INVALID_INPUT_TYPE");
        expect(err.details?.expected).toBe("Uint8Array");
        expect(err.details?.actual).toBe("string");
      }
    });

    it("throws when encoding string as hex", async () => {
      await expect(fulencode.encode("hello", EncodingFormat.HEX)).rejects.toThrow(FulencodeError);
    });

    it("throws when encoding string as base32", async () => {
      await expect(fulencode.encode("hello", EncodingFormat.BASE32)).rejects.toThrow(FulencodeError);
    });
  });

  describe("text encoding formats", () => {
    describe("utf-8", () => {
      it("encodes bytes to utf-8 string", async () => {
        const bytes = new TextEncoder().encode("Hello World");
        const result = await fulencode.encode(bytes, EncodingFormat.UTF8);
        expect(result.data).toBe("Hello World");
      });

      it("passes through string input with warning", async () => {
        const result = await fulencode.encode("Hello World", EncodingFormat.UTF8);
        expect(result.data).toBe("Hello World");
        expect(result.warnings).toContain("string_input_passthrough");
      });

      it("handles strict mode with invalid utf-8", async () => {
        const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
        // In strict mode, invalid sequences throw
        await expect(
          fulencode.encode(invalidUtf8, EncodingFormat.UTF8, { onError: "strict" }),
        ).rejects.toThrow();
      });

      it("handles replace mode with invalid utf-8", async () => {
        const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
        // In replace mode, invalid sequences are replaced
        const result = await fulencode.encode(invalidUtf8, EncodingFormat.UTF8, {
          onError: "replace",
        });
        expect(result.data).toBeDefined();
      });
    });

    describe("utf-16le", () => {
      it("encodes bytes to utf-16le string", async () => {
        // "Hi" in UTF-16LE: H=0x48 i=0x69
        const bytes = new Uint8Array([0x48, 0x00, 0x69, 0x00]);
        const result = await fulencode.encode(bytes, EncodingFormat.UTF16LE);
        expect(result.data).toBe("Hi");
      });

      it("passes through string input with warning", async () => {
        const result = await fulencode.encode("Hi", EncodingFormat.UTF16LE);
        expect(result.data).toBe("Hi");
        expect(result.warnings).toContain("string_input_passthrough");
      });
    });

    describe("utf-16be", () => {
      it("encodes bytes to utf-16be string", async () => {
        // "Hi" in UTF-16BE: H=0x0048 i=0x0069
        const bytes = new Uint8Array([0x00, 0x48, 0x00, 0x69]);
        const result = await fulencode.encode(bytes, EncodingFormat.UTF16BE);
        expect(result.data).toBe("Hi");
      });

      it("passes through string input with warning", async () => {
        const result = await fulencode.encode("AB", EncodingFormat.UTF16BE);
        expect(result.data).toBe("AB");
        expect(result.warnings).toContain("string_input_passthrough");
      });
    });

    describe("iso-8859-1", () => {
      it("encodes bytes to iso-8859-1 string", async () => {
        const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // Hello
        const result = await fulencode.encode(bytes, EncodingFormat.ISO_8859_1);
        expect(result.data).toBe("Hello");
      });

      it("passes through string input with warning", async () => {
        const result = await fulencode.encode("Hello", EncodingFormat.ISO_8859_1);
        expect(result.data).toBe("Hello");
        expect(result.warnings).toContain("string_input_passthrough");
      });
    });

    describe("ascii", () => {
      it("encodes bytes to ascii string", async () => {
        const bytes = new Uint8Array([0x41, 0x42, 0x43]); // ABC
        const result = await fulencode.encode(bytes, EncodingFormat.ASCII);
        expect(result.data).toBe("ABC");
      });

      it("passes through string input with warning", async () => {
        const result = await fulencode.encode("ABC", EncodingFormat.ASCII);
        expect(result.data).toBe("ABC");
        expect(result.warnings).toContain("string_input_passthrough");
      });
    });

    describe("cp1252", () => {
      it("throws UNSUPPORTED_FORMAT for cp1252 encode", async () => {
        const bytes = new Uint8Array([0x41]);
        await expect(fulencode.encode(bytes, EncodingFormat.CP1252)).rejects.toThrow(FulencodeError);

        try {
          await fulencode.encode(bytes, EncodingFormat.CP1252);
        } catch (e) {
          const err = e as FulencodeError;
          expect(err.code).toBe("UNSUPPORTED_FORMAT");
          expect(err.message).toContain("cp1252");
        }
      });
    });
  });

  describe("base64_raw format", () => {
    it("encodes without padding", async () => {
      const data = new Uint8Array([1, 2, 3]);
      const result = await fulencode.encode(data, EncodingFormat.BASE64_RAW);
      expect(result.data).not.toContain("=");
    });
  });

  describe("unsupported format", () => {
    it("throws for unknown format", async () => {
      const data = new Uint8Array([1]);
      await expect(fulencode.encode(data, "unknown" as EncodingFormat)).rejects.toThrow(
        FulencodeError,
      );

      try {
        await fulencode.encode(data, "unknown" as EncodingFormat);
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("UNSUPPORTED_FORMAT");
      }
    });
  });
});

describe("fulencode decode coverage", () => {
  describe("text formats decoding", () => {
    describe("utf-8", () => {
      it("decodes string to utf-8 bytes", async () => {
        const result = await fulencode.decode("Hello", EncodingFormat.UTF8);
        expect(new TextDecoder().decode(result.data)).toBe("Hello");
      });

      it("decodes Uint8Array input as utf-8", async () => {
        const input = new TextEncoder().encode("Hello World");
        const result = await fulencode.decode(input, EncodingFormat.UTF8);
        expect(new TextDecoder().decode(result.data)).toBe("Hello World");
      });
    });

    describe("utf-16le", () => {
      it("decodes string to utf-16le bytes", async () => {
        const result = await fulencode.decode("Hi", EncodingFormat.UTF16LE);
        // "Hi" in UTF-16LE
        expect(result.data[0]).toBe(0x48); // H low byte
        expect(result.data[1]).toBe(0x00); // H high byte
        expect(result.data[2]).toBe(0x69); // i low byte
        expect(result.data[3]).toBe(0x00); // i high byte
      });

      it("decodes Uint8Array input for utf-16le", async () => {
        const input = new TextEncoder().encode("AB");
        const result = await fulencode.decode(input, EncodingFormat.UTF16LE);
        expect(result.data).toBeDefined();
      });
    });

    describe("utf-16be", () => {
      it("decodes string to utf-16be bytes", async () => {
        const result = await fulencode.decode("Hi", EncodingFormat.UTF16BE);
        // "Hi" in UTF-16BE (bytes swapped from LE)
        expect(result.data[0]).toBe(0x00); // H high byte
        expect(result.data[1]).toBe(0x48); // H low byte
        expect(result.data[2]).toBe(0x00); // i high byte
        expect(result.data[3]).toBe(0x69); // i low byte
      });

      it("decodes Uint8Array input for utf-16be", async () => {
        const input = new TextEncoder().encode("XY");
        const result = await fulencode.decode(input, EncodingFormat.UTF16BE);
        expect(result.data).toBeDefined();
      });
    });

    describe("iso-8859-1", () => {
      it("decodes string to iso-8859-1 bytes", async () => {
        const result = await fulencode.decode("Hello", EncodingFormat.ISO_8859_1);
        expect(Array.from(result.data)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      });

      it("decodes Uint8Array input for iso-8859-1", async () => {
        const input = new TextEncoder().encode("Test");
        const result = await fulencode.decode(input, EncodingFormat.ISO_8859_1);
        expect(result.data).toBeDefined();
      });
    });

    describe("ascii", () => {
      it("decodes string to ascii bytes", async () => {
        const result = await fulencode.decode("ABC", EncodingFormat.ASCII);
        expect(Array.from(result.data)).toEqual([0x41, 0x42, 0x43]);
      });

      it("decodes Uint8Array input for ascii", async () => {
        const input = new TextEncoder().encode("xyz");
        const result = await fulencode.decode(input, EncodingFormat.ASCII);
        expect(result.data).toBeDefined();
      });
    });

    describe("cp1252", () => {
      it("throws UNSUPPORTED_FORMAT for cp1252 decode", async () => {
        await expect(fulencode.decode("test", EncodingFormat.CP1252)).rejects.toThrow(
          FulencodeError,
        );

        try {
          await fulencode.decode("test", EncodingFormat.CP1252);
        } catch (e) {
          const err = e as FulencodeError;
          expect(err.code).toBe("UNSUPPORTED_FORMAT");
          expect(err.operation).toBe("decode");
        }
      });
    });
  });

  describe("base64_raw format", () => {
    it("decodes base64 without padding validation", async () => {
      const original = new Uint8Array([1, 2, 3]);
      const encoded = await fulencode.encode(original, EncodingFormat.BASE64_RAW);
      const decoded = await fulencode.decode(encoded.data, EncodingFormat.BASE64_RAW, {
        validatePadding: true,
      });

      expect(Array.from(decoded.data)).toEqual(Array.from(original));
      expect(decoded.warnings).toContain("base64_raw does not support padding validation");
    });
  });

  describe("hex format", () => {
    it("decodes valid hex in strict mode", async () => {
      const result = await fulencode.decode("48656c6c6f", EncodingFormat.HEX, {
        onError: "strict",
      });
      expect(new TextDecoder().decode(result.data)).toBe("Hello");
    });

    it("throws on invalid hex in strict mode", async () => {
      await expect(
        fulencode.decode("48656c6c6g", EncodingFormat.HEX, { onError: "strict" }),
      ).rejects.toThrow();
    });

    it("throws on odd-length hex in strict mode", async () => {
      await expect(
        fulencode.decode("48656c6c6", EncodingFormat.HEX, { onError: "strict" }),
      ).rejects.toThrow();
    });

    it("handles non-strict mode for hex", async () => {
      // In non-strict mode, Buffer.from handles invalid chars gracefully
      const result = await fulencode.decode("4142", EncodingFormat.HEX, {
        onError: "replace",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("base64 strict mode", () => {
    it("throws on invalid base64 characters in strict mode", async () => {
      await expect(
        fulencode.decode("!!!!", EncodingFormat.BASE64, { onError: "strict" }),
      ).rejects.toThrow();
    });

    it("throws on invalid base64 padding in strict mode", async () => {
      // Padding in wrong position
      await expect(
        fulencode.decode("YQ=x", EncodingFormat.BASE64, { onError: "strict", validatePadding: true }),
      ).rejects.toThrow();
    });

    it("throws on invalid base64 length in strict mode", async () => {
      // The decode function adds padding before validation, so we need to test with
      // actual invalid padded input - like having a character after padding begins
      await expect(
        fulencode.decode("YQ=a", EncodingFormat.BASE64, { onError: "strict", validatePadding: true }),
      ).rejects.toThrow();
    });

    it("decodes in non-strict mode", async () => {
      const result = await fulencode.decode("SGVsbG8", EncodingFormat.BASE64, {
        onError: "replace",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("base64url strict mode", () => {
    it("decodes valid base64url in strict mode", async () => {
      const original = new Uint8Array([0xff, 0xee, 0xdd]);
      const encoded = await fulencode.encode(original, EncodingFormat.BASE64URL);
      const decoded = await fulencode.decode(encoded.data, EncodingFormat.BASE64URL, {
        onError: "strict",
      });
      expect(Array.from(decoded.data)).toEqual(Array.from(original));
    });

    it("throws on invalid base64url characters in strict mode", async () => {
      await expect(
        fulencode.decode("+/==", EncodingFormat.BASE64URL, { onError: "strict" }),
      ).rejects.toThrow();
    });

    it("decodes in non-strict mode", async () => {
      const result = await fulencode.decode("SGVsbG8", EncodingFormat.BASE64URL, {
        onError: "replace",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("maxDecodedSize limit", () => {
    it("throws when decoded output exceeds maxDecodedSize", async () => {
      // Encode a 100-byte array
      const original = new Uint8Array(100);
      const encoded = await fulencode.encode(original, EncodingFormat.BASE64);

      await expect(
        fulencode.decode(encoded.data, EncodingFormat.BASE64, {
          maxDecodedSize: 10,
        }),
      ).rejects.toThrow(FulencodeError);

      try {
        await fulencode.decode(encoded.data, EncodingFormat.BASE64, {
          maxDecodedSize: 10,
        });
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("OUTPUT_TOO_LARGE");
        expect(err.operation).toBe("decode");
        expect(err.details?.maxDecodedSize).toBe(10);
      }
    });
  });

  describe("computeChecksum on decode", () => {
    it("computes sha256 checksum on decode", async () => {
      const result = await fulencode.decode("SGVsbG8gV29ybGQ=", EncodingFormat.BASE64, {
        computeChecksum: "sha256",
      });

      expect(result.checksum).toBeDefined();
      expect(result.checksumAlgorithm).toBe("sha256");
    });

    it("computes xxh3-128 checksum on decode", async () => {
      const result = await fulencode.decode("SGVsbG8gV29ybGQ=", EncodingFormat.BASE64, {
        computeChecksum: "xxh3-128",
      });

      expect(result.checksum).toBeDefined();
      expect(result.checksumAlgorithm).toBe("xxh3-128");
    });
  });

  describe("unsupported format", () => {
    it("throws for unknown format", async () => {
      await expect(fulencode.decode("test", "unknown" as EncodingFormat)).rejects.toThrow(
        FulencodeError,
      );

      try {
        await fulencode.decode("test", "unknown" as EncodingFormat);
      } catch (e) {
        const err = e as FulencodeError;
        expect(err.code).toBe("UNSUPPORTED_FORMAT");
        expect(err.operation).toBe("decode");
      }
    });
  });

  describe("Uint8Array input to decode", () => {
    it("accepts Uint8Array input for base64 decode", async () => {
      const base64Str = "SGVsbG8=";
      const input = new TextEncoder().encode(base64Str);
      const result = await fulencode.decode(input, EncodingFormat.BASE64);
      expect(new TextDecoder().decode(result.data)).toBe("Hello");
    });
  });

  describe("whitespace handling", () => {
    it("ignores whitespace in base64 by default", async () => {
      const result = await fulencode.decode("SGVs\nbG8=", EncodingFormat.BASE64);
      expect(new TextDecoder().decode(result.data)).toBe("Hello");
    });

    it("ignores whitespace in hex by default", async () => {
      const result = await fulencode.decode("48 65 6c 6c 6f", EncodingFormat.HEX);
      expect(new TextDecoder().decode(result.data)).toBe("Hello");
    });

    it("respects ignoreWhitespace=false", async () => {
      // With ignoreWhitespace=false, whitespace becomes part of input
      // For text formats, this means whitespace is preserved
      const result = await fulencode.decode("Hello World", EncodingFormat.UTF8, {
        ignoreWhitespace: false,
      });
      expect(new TextDecoder().decode(result.data)).toBe("Hello World");
    });
  });
});
