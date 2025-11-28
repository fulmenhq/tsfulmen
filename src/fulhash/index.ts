/**
 * FulHash - Consistent hashing API for Fulmen ecosystem
 *
 * Provides block and streaming hashing with xxh3-128 and sha256 algorithms.
 * Cross-language compatible with gofulmen and pyfulmen.
 */

export const VERSION = "1.0.0";

export * from "../crucible/fulhash/types.js";
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
