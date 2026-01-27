import { Algorithm } from "../crucible/fulhash/types.js";
import { hashBytes } from "../fulhash/hash.js";
import { decodeBase32, encodeBase32 } from "./base32.js";
import { FulencodeError } from "./errors.js";
import type {
  DecodeOptions,
  DecodingResult,
  EncodeOptions,
  EncodingFormat,
  EncodingResult,
} from "./types.js";

function wrapLines(data: string, lineLength: number, lineEnding: "\n" | "\r\n"): string {
  if (lineLength <= 0) return data;
  let out = "";
  for (let i = 0; i < data.length; i += lineLength) {
    out += data.slice(i, i + lineLength);
    if (i + lineLength < data.length) out += lineEnding;
  }
  return out;
}

function requireBytes(input: Uint8Array | string, format: EncodingFormat): Uint8Array {
  if (typeof input === "string") {
    throw new FulencodeError({
      code: "INVALID_INPUT_TYPE",
      message: `Format '${format}' requires binary input (Uint8Array)`,
      operation: "encode",
      outputFormat: format,
      details: { expected: "Uint8Array", actual: "string" },
    });
  }
  return input;
}

function normalizeWhitespace(input: string, ignoreWhitespace: boolean): string {
  if (!ignoreWhitespace) return input;
  return input.replace(/[\n\r\t\s]/g, "");
}

function base64FromBytes(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function base64UrlFromBytes(data: Uint8Array): string {
  // Derive from base64 for consistent padding control.
  return base64FromBytes(data).replace(/\+/g, "-").replace(/\//g, "_");
}

function applyBase64Padding(s: string, padding: boolean): string {
  return padding ? s.padEnd(Math.ceil(s.length / 4) * 4, "=") : s.replace(/=+$/g, "");
}

function decodeBase64Strict(
  input: string,
  variant: "base64" | "base64url",
  validatePadding: boolean,
): Uint8Array {
  const allowed = variant === "base64" ? /^[A-Za-z0-9+/]*={0,2}$/ : /^[A-Za-z0-9\-_]*={0,2}$/;
  if (!allowed.test(input)) {
    throw new Error("Invalid base64 characters");
  }

  if (validatePadding) {
    if (input.length % 4 !== 0) {
      throw new Error("Invalid base64 length");
    }
    const firstPad = input.indexOf("=");
    if (firstPad !== -1) {
      for (let i = firstPad; i < input.length; i++) {
        if (input[i] !== "=") throw new Error("Invalid base64 padding");
      }
    }
  }

  const s = variant === "base64url" ? input.replace(/-/g, "+").replace(/_/g, "/") : input;
  return Uint8Array.from(Buffer.from(s, "base64"));
}

async function computeChecksumIfRequested(
  data: Uint8Array,
  algorithm?: string,
): Promise<{ checksum?: string; checksumAlgorithm?: string }> {
  if (!algorithm) return {};

  if (algorithm !== "sha256" && algorithm !== "xxh3-128") {
    throw new FulencodeError({
      code: "UNSUPPORTED_CHECKSUM",
      message: `Unsupported checksum algorithm: ${algorithm}`,
      operation: "encode",
      details: { algorithm },
    });
  }

  const digest = await hashBytes(data, {
    algorithm: algorithm === "sha256" ? Algorithm.SHA256 : Algorithm.XXH3_128,
  });

  return { checksum: digest.toString(), checksumAlgorithm: algorithm };
}

export async function encode(
  input: Uint8Array | string,
  format: EncodingFormat,
  options: EncodeOptions = {},
): Promise<EncodingResult> {
  const warnings: string[] = [];
  if (options.embedChecksum) {
    throw new FulencodeError({
      code: "UNSUPPORTED_FEATURE",
      message: "embedChecksum is not implemented in tsfulmen yet",
      operation: "encode",
      outputFormat: format,
    });
  }

  const padding = options.padding ?? true;
  const lineLength = options.lineLength ?? null;
  const lineEnding = options.lineEnding ?? "\n";
  const maxEncodedSize = options.maxEncodedSize ?? 500 * 1024 * 1024;
  const onError = options.onError ?? "strict";

  let data: string;
  let inputBytes: Uint8Array;

  try {
    switch (format) {
      case "base64": {
        inputBytes = requireBytes(input, format);
        data = applyBase64Padding(base64FromBytes(inputBytes), padding);
        break;
      }
      case "base64url": {
        inputBytes = requireBytes(input, format);
        data = applyBase64Padding(base64UrlFromBytes(inputBytes), padding);
        break;
      }
      case "base64_raw": {
        inputBytes = requireBytes(input, format);
        data = applyBase64Padding(base64FromBytes(inputBytes), false);
        break;
      }
      case "hex": {
        inputBytes = requireBytes(input, format);
        const hex = Buffer.from(inputBytes).toString("hex");
        data = (options.hexCase ?? "lower") === "upper" ? hex.toUpperCase() : hex;
        break;
      }
      case "base32":
      case "base32hex": {
        inputBytes = requireBytes(input, format);
        data = encodeBase32(inputBytes, format, { padding });
        break;
      }
      case "utf-8": {
        if (typeof input === "string") {
          // Pass-through for already-decoded text; decode() is the canonical text->bytes operation.
          data = input;
          inputBytes = new TextEncoder().encode(input);
          warnings.push("string_input_passthrough");
        } else {
          inputBytes = input;
          if (onError === "strict") {
            data = new TextDecoder("utf-8", { fatal: true }).decode(inputBytes);
          } else {
            data = new TextDecoder("utf-8", { fatal: false }).decode(inputBytes);
          }
        }
        break;
      }
      case "utf-16le": {
        if (typeof input === "string") {
          data = input;
          inputBytes = Uint8Array.from(Buffer.from(input, "utf16le"));
          warnings.push("string_input_passthrough");
        } else {
          inputBytes = input;
          data = Buffer.from(inputBytes).toString("utf16le");
        }
        break;
      }
      case "utf-16be": {
        if (typeof input === "string") {
          data = input;
          const le = Buffer.from(input, "utf16le");
          for (let i = 0; i + 1 < le.length; i += 2) {
            const a = le[i];
            le[i] = le[i + 1];
            le[i + 1] = a;
          }
          inputBytes = Uint8Array.from(le);
          warnings.push("string_input_passthrough");
        } else {
          inputBytes = input;
          const swapped = Buffer.from(inputBytes);
          for (let i = 0; i + 1 < swapped.length; i += 2) {
            const a = swapped[i];
            swapped[i] = swapped[i + 1];
            swapped[i + 1] = a;
          }
          data = swapped.toString("utf16le");
        }
        break;
      }
      case "iso-8859-1": {
        if (typeof input === "string") {
          data = input;
          inputBytes = Uint8Array.from(Buffer.from(input, "latin1"));
          warnings.push("string_input_passthrough");
        } else {
          inputBytes = input;
          data = Buffer.from(inputBytes).toString("latin1");
        }
        break;
      }
      case "ascii": {
        if (typeof input === "string") {
          data = input;
          inputBytes = Uint8Array.from(Buffer.from(input, "ascii"));
          warnings.push("string_input_passthrough");
        } else {
          inputBytes = input;
          data = Buffer.from(inputBytes).toString("ascii");
        }
        break;
      }
      case "cp1252": {
        throw new FulencodeError({
          code: "UNSUPPORTED_FORMAT",
          message: "cp1252 is not implemented in tsfulmen yet",
          operation: "encode",
          outputFormat: format,
        });
      }
      default: {
        throw new FulencodeError({
          code: "UNSUPPORTED_FORMAT",
          message: `Unsupported encoding format: ${format}`,
          operation: "encode",
          outputFormat: format,
        });
      }
    }
  } catch (err) {
    if (err instanceof FulencodeError) throw err;
    throw new FulencodeError({
      code: "ENCODE_FAILED",
      message: (err as Error).message,
      operation: "encode",
      outputFormat: format,
      cause: err,
    });
  }

  if (lineLength !== null) {
    data = wrapLines(data, lineLength, lineEnding);
  }

  if (data.length > maxEncodedSize) {
    throw new FulencodeError({
      code: "OUTPUT_TOO_LARGE",
      message: `Encoded output exceeds maxEncodedSize (${maxEncodedSize})`,
      operation: "encode",
      outputFormat: format,
      details: { maxEncodedSize, outputSize: data.length },
    });
  }

  const checksum = await computeChecksumIfRequested(inputBytes, options.computeChecksum);

  return {
    data,
    format,
    inputSize: inputBytes.length,
    outputSize: data.length,
    warnings,
    ...checksum,
  };
}

export async function decode(
  input: string | Uint8Array,
  format: EncodingFormat,
  options: DecodeOptions = {},
): Promise<DecodingResult> {
  const warnings: string[] = [];
  const ignoreWhitespace =
    options.ignoreWhitespace ??
    (format === "base64" ||
      format === "base64url" ||
      format === "hex" ||
      format === "base32" ||
      format === "base32hex");
  const validatePadding =
    options.validatePadding ??
    (format === "base64" ||
      format === "base64url" ||
      format === "base32" ||
      format === "base32hex");
  const maxDecodedSize = options.maxDecodedSize ?? 100 * 1024 * 1024;
  const onError = options.onError ?? "strict";

  const inputStr = typeof input === "string" ? input : Buffer.from(input).toString("utf8");
  const normalized = normalizeWhitespace(inputStr, ignoreWhitespace);
  let decoded: Uint8Array;
  const correctionsApplied = 0;

  try {
    switch (format) {
      case "base64": {
        const s = applyBase64Padding(normalized, true);
        decoded =
          onError === "strict"
            ? decodeBase64Strict(s, "base64", validatePadding)
            : Uint8Array.from(Buffer.from(s, "base64"));
        break;
      }
      case "base64url": {
        const s = applyBase64Padding(normalized, true);
        decoded =
          onError === "strict"
            ? decodeBase64Strict(s, "base64url", validatePadding)
            : Uint8Array.from(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
        break;
      }
      case "base64_raw": {
        const s = applyBase64Padding(normalized, true);
        decoded = Uint8Array.from(Buffer.from(s, "base64"));
        if (validatePadding) warnings.push("base64_raw does not support padding validation");
        break;
      }
      case "hex": {
        const s = normalized;
        if (onError === "strict") {
          if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2 !== 0) {
            throw new Error("Invalid hex input");
          }
        }
        decoded = Uint8Array.from(Buffer.from(s, "hex"));
        break;
      }
      case "base32":
      case "base32hex": {
        decoded = decodeBase32(normalized, format, {
          ignoreWhitespace,
          validatePadding,
        });
        break;
      }
      case "utf-8": {
        // Text-to-bytes
        decoded = new TextEncoder().encode(typeof input === "string" ? input : inputStr);
        break;
      }
      case "utf-16le": {
        decoded = Uint8Array.from(
          Buffer.from(typeof input === "string" ? input : inputStr, "utf16le"),
        );
        break;
      }
      case "utf-16be": {
        const buf = Buffer.from(typeof input === "string" ? input : inputStr, "utf16le");
        for (let i = 0; i + 1 < buf.length; i += 2) {
          const a = buf[i];
          buf[i] = buf[i + 1];
          buf[i + 1] = a;
        }
        decoded = Uint8Array.from(buf);
        break;
      }
      case "iso-8859-1": {
        decoded = Uint8Array.from(
          Buffer.from(typeof input === "string" ? input : inputStr, "latin1"),
        );
        break;
      }
      case "ascii": {
        decoded = Uint8Array.from(
          Buffer.from(typeof input === "string" ? input : inputStr, "ascii"),
        );
        break;
      }
      case "cp1252": {
        throw new FulencodeError({
          code: "UNSUPPORTED_FORMAT",
          message: "cp1252 is not implemented in tsfulmen yet",
          operation: "decode",
          inputFormat: format,
        });
      }
      default: {
        throw new FulencodeError({
          code: "UNSUPPORTED_FORMAT",
          message: `Unsupported decoding format: ${format}`,
          operation: "decode",
          inputFormat: format,
        });
      }
    }
  } catch (err) {
    if (err instanceof FulencodeError) throw err;
    throw new FulencodeError({
      code: "DECODE_FAILED",
      message: (err as Error).message,
      operation: "decode",
      inputFormat: format,
      cause: err,
    });
  }

  if (decoded.length > maxDecodedSize) {
    throw new FulencodeError({
      code: "OUTPUT_TOO_LARGE",
      message: `Decoded output exceeds maxDecodedSize (${maxDecodedSize})`,
      operation: "decode",
      inputFormat: format,
      details: { maxDecodedSize, outputSize: decoded.length },
    });
  }

  const checksum = await computeChecksumIfRequested(decoded, options.computeChecksum);

  return {
    data: decoded,
    format,
    inputSize: typeof input === "string" ? Buffer.byteLength(input, "utf8") : input.length,
    outputSize: decoded.length,
    warnings,
    correctionsApplied,
    ...checksum,
  };
}
