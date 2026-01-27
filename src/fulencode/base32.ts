const RFC4648_BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RFC4648_BASE32HEX_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUV";

function getAlphabet(variant: "base32" | "base32hex"): string {
  return variant === "base32" ? RFC4648_BASE32_ALPHABET : RFC4648_BASE32HEX_ALPHABET;
}

export function encodeBase32(
  data: Uint8Array,
  variant: "base32" | "base32hex",
  options: { padding: boolean },
): string {
  if (data.length === 0) return "";

  const alphabet = getAlphabet(variant);
  let bits = 0;
  let value = 0;
  let out = "";

  for (const b of data) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      const idx = (value >>> (bits - 5)) & 31;
      out += alphabet[idx];
      bits -= 5;
    }
  }

  if (bits > 0) {
    const idx = (value << (5 - bits)) & 31;
    out += alphabet[idx];
  }

  if (options.padding) {
    while (out.length % 8 !== 0) out += "=";
  }

  return out;
}

function buildDecodeMap(alphabet: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) {
    const ch = alphabet[i];
    map.set(ch, i);
    map.set(ch.toLowerCase(), i);
  }
  return map;
}

export function decodeBase32(
  input: string,
  variant: "base32" | "base32hex",
  options: { ignoreWhitespace: boolean; validatePadding: boolean },
): Uint8Array {
  const alphabet = getAlphabet(variant);
  const decodeMap = buildDecodeMap(alphabet);

  let s = input;
  if (options.ignoreWhitespace) {
    s = s.replace(/[\n\r\t\s]/g, "");
  }

  // Split padding for strict checks.
  const firstPad = s.indexOf("=");
  if (firstPad !== -1) {
    if (options.validatePadding) {
      for (let i = firstPad; i < s.length; i++) {
        if (s[i] !== "=") {
          throw new Error("Invalid base32 padding");
        }
      }
      if (s.length % 8 !== 0) {
        throw new Error("Invalid base32 length (padding)");
      }
    }
    s = s.slice(0, firstPad);
  }

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const v = decodeMap.get(ch);
    if (v === undefined) {
      throw new Error(`Invalid base32 character: ${ch}`);
    }

    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Uint8Array.from(out);
}
