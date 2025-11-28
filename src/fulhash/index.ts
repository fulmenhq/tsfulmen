/**
 * FulHash - Consistent hashing API for Fulmen ecosystem
 *
 * Provides block and streaming hashing with XXH3-128, SHA-256, CRC32, and CRC32C algorithms.
 * Cross-language compatible with gofulmen and pyfulmen.
 */

export const VERSION = "1.0.0";

export * from "../crucible/fulhash/types.js";
export { type HashInput, multiHash, verify } from "./convenience.js";
export type {
  HashOptions,
  StreamHasher,
  StreamHasherOptions,
} from "./definitions.js";
export { Digest } from "./digest.js";
export {
  DigestStateError,
  FulHashError,
  InvalidChecksumError,
  InvalidChecksumFormatError,
  UnsupportedAlgorithmError,
} from "./errors.js";
export { hash, hashBytes, hashString } from "./hash.js";
export { createStreamHasher } from "./stream.js";
