/**
 * Block hashing helpers for one-shot hashing operations
 */

import { Algorithm } from "../crucible/fulhash/types.js";
import * as crc32 from "./algorithms/crc32.js";
import * as crc32c from "./algorithms/crc32c.js";
import * as sha256 from "./algorithms/sha256.js";
import * as xxh3 from "./algorithms/xxh3.js";
import type { HashOptions } from "./definitions.js";
import { Digest } from "./digest.js";
import { UnsupportedAlgorithmError } from "./errors.js";

export async function hash(input: string | Uint8Array, options?: HashOptions): Promise<Digest> {
  const algorithm = options?.algorithm ?? Algorithm.XXH3_128;
  const encoding = options?.encoding ?? "utf8";

  let bytes: Uint8Array;

  switch (algorithm) {
    case Algorithm.SHA256:
      if (typeof input === "string") {
        bytes = sha256.hashString(input, encoding);
      } else {
        bytes = sha256.hashBytes(input);
      }
      break;
    case Algorithm.XXH3_128:
      if (typeof input === "string") {
        if (encoding !== "utf8") {
          // Fallback via buffer if non-utf8 is requested, as xxh3-wasm is utf8 only
          bytes = await xxh3.hashBytes(Buffer.from(input, encoding));
        } else {
          bytes = await xxh3.hashString(input, "utf8");
        }
      } else {
        bytes = await xxh3.hashBytes(input);
      }
      break;
    case Algorithm.CRC32:
      if (typeof input === "string") {
        bytes = await crc32.hashString(input, encoding);
      } else {
        bytes = await crc32.hashBytes(input);
      }
      break;
    case Algorithm.CRC32C:
      if (typeof input === "string") {
        bytes = await crc32c.hashString(input, encoding);
      } else {
        bytes = await crc32c.hashBytes(input);
      }
      break;
    default:
      throw new UnsupportedAlgorithmError(algorithm, Object.values(Algorithm));
  }

  return new Digest(algorithm, bytes);
}

export async function hashString(str: string, options?: HashOptions): Promise<Digest> {
  return hash(str, options);
}

export async function hashBytes(data: Uint8Array, options?: HashOptions): Promise<Digest> {
  return hash(data, options);
}
