/**
 * Fulencode types - canonical encoding/decoding interfaces.
 */

export const EncodingFormat = {
  BASE64: "base64",
  BASE64URL: "base64url",
  BASE64_RAW: "base64_raw",
  BASE32: "base32",
  BASE32HEX: "base32hex",
  HEX: "hex",
  UTF8: "utf-8",
  UTF16LE: "utf-16le",
  UTF16BE: "utf-16be",
  ISO_8859_1: "iso-8859-1",
  CP1252: "cp1252",
  ASCII: "ascii",
} as const;

export type EncodingFormat = (typeof EncodingFormat)[keyof typeof EncodingFormat];

export type OnErrorMode = "strict" | "replace" | "ignore";
export type DecodeOnErrorMode = OnErrorMode | "fallback";

export interface EncodeOptions {
  padding?: boolean;
  hexCase?: "upper" | "lower";
  lineLength?: number | null;
  lineEnding?: "\n" | "\r\n";
  maxEncodedSize?: number;

  computeChecksum?: string;
  embedChecksum?: boolean;

  onError?: OnErrorMode;
}

export interface EncodingResult {
  data: string;
  format: EncodingFormat;
  inputSize: number;
  outputSize: number;
  checksum?: string;
  checksumAlgorithm?: string;
  warnings: string[];
}

export interface DecodeOptions {
  verifyChecksum?: boolean;
  computeChecksum?: string;
  maxDecodedSize?: number;

  onError?: DecodeOnErrorMode;
  fallbackFormats?: EncodingFormat[];

  ignoreWhitespace?: boolean;
  validatePadding?: boolean;
}

export interface DecodingResult {
  data: Uint8Array;
  format: EncodingFormat;
  inputSize: number;
  outputSize: number;
  checksum?: string;
  checksumVerified?: boolean;
  checksumAlgorithm?: string;
  warnings: string[];
  correctionsApplied: number;
}
