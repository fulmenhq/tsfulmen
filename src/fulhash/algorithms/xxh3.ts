import { xxhash128 } from "hash-wasm";
import { FulHashError } from "../errors.js";

/**
 * Convert hex string to Uint8Array
 * @internal
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Hash bytes using XXH3-128 algorithm
 *
 * Uses the cached hash-wasm xxhash128() helper for optimal performance.
 * The WASM module is initialized once and reused across all calls.
 *
 * @param data - Input data as Uint8Array
 * @returns Hash digest as Uint8Array (16 bytes)
 */
export async function hashBytes(data: Uint8Array): Promise<Uint8Array> {
  // Use cached xxhash128 helper - returns hex string
  const hex = await xxhash128(data);
  return hexToBytes(hex);
}

/**
 * Hash string using XXH3-128 algorithm
 *
 * Uses the cached hash-wasm xxhash128() helper for optimal performance.
 * The WASM module is initialized once and reused across all calls.
 *
 * @param str - Input string
 * @param encoding - Character encoding (only 'utf8' supported)
 * @returns Hash digest as Uint8Array (16 bytes)
 */
export async function hashString(
  str: string,
  encoding: "utf8" | "utf16le" = "utf8",
): Promise<Uint8Array> {
  if (encoding !== "utf8") {
    throw new FulHashError(
      "XXH3-128 only supports UTF-8 encoding. Use utf8 encoding or convert data to Uint8Array.",
    );
  }

  // Use cached xxhash128 helper directly on string
  const hex = await xxhash128(str);
  return hexToBytes(hex);
}
