import { describe, expect, it } from "vitest";
import { EncodingFormat, fulencode } from "../index.js";

describe("fulencode", () => {
  it("round-trips base64url without padding", async () => {
    const data = new Uint8Array([0xff, 0xee, 0xdd, 0xcc, 0xbb]);

    const encoded = await fulencode.encode(data, EncodingFormat.BASE64URL, {
      padding: false,
    });
    expect(encoded.data).not.toContain("=");
    expect(encoded.data).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = await fulencode.decode(encoded.data, EncodingFormat.BASE64URL);
    expect(Array.from(decoded.data)).toEqual(Array.from(data));
  });

  it("encodes base32 per RFC4648 test vector", async () => {
    const bytes = new TextEncoder().encode("foobar");
    const encoded = await fulencode.encode(bytes, EncodingFormat.BASE32, {
      padding: true,
    });
    expect(encoded.data).toBe("MZXW6YTBOI======");

    const decoded = await fulencode.decode(encoded.data, EncodingFormat.BASE32);
    expect(new TextDecoder().decode(decoded.data)).toBe("foobar");
  });

  it("encodes base32hex per RFC4648 test vector", async () => {
    const bytes = new TextEncoder().encode("foobar");
    const encoded = await fulencode.encode(bytes, EncodingFormat.BASE32HEX, {
      padding: true,
    });
    expect(encoded.data).toBe("CPNMUOJ1E8======");
  });

  it("supports uppercase hex output", async () => {
    const bytes = new Uint8Array([0x0a, 0xbc, 0x12]);
    const encoded = await fulencode.encode(bytes, EncodingFormat.HEX, {
      hexCase: "upper",
    });
    expect(encoded.data).toBe("0ABC12");

    const decoded = await fulencode.decode(encoded.data, EncodingFormat.HEX);
    expect(Array.from(decoded.data)).toEqual(Array.from(bytes));
  });
});
