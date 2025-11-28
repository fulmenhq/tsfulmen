import type { Algorithm } from "../crucible/fulhash/types.js";
import type { MultiHashResult, StreamHasher } from "./definitions.js";
import { Digest } from "./digest.js";
import { createStreamHasher } from "./stream.js";

export type HashInput = string | Uint8Array | AsyncIterable<string | Uint8Array>;

/**
 * Compute multiple hashes in a single pass over the data.
 * Useful for generating checksums for multiple algorithms (e.g. SHA256 + XXH3)
 * without reading the stream multiple times.
 */
export async function multiHash(
  input: HashInput,
  algorithms: Algorithm[],
  encoding: BufferEncoding = "utf8",
): Promise<MultiHashResult> {
  const uniqueAlgorithms = [...new Set(algorithms)];
  const hashers: StreamHasher[] = await Promise.all(
    uniqueAlgorithms.map((algo) => createStreamHasher({ algorithm: algo })),
  );

  if (typeof input === "string") {
    if (encoding !== "utf8") {
      // Manual buffer conversion for non-utf8 encodings, as some stream hashers
      // (like XXH3) might default to UTF-8 for string inputs.
      const buf = Buffer.from(input, encoding);
      for (const hasher of hashers) {
        hasher.update(buf);
      }
    } else {
      for (const hasher of hashers) {
        hasher.update(input);
      }
    }
  } else if (input instanceof Uint8Array) {
    for (const hasher of hashers) {
      hasher.update(input);
    }
  } else {
    // AsyncIterable (Stream)
    for await (const chunk of input) {
      // If chunk is string and encoding is non-utf8, we might have an issue here
      // as the stream chunk doesn't carry encoding info.
      // Standard Node streams yield Buffers or strings (usually utf8).
      // If the user passes an async iterable of strings, we assume they are safe to pass to update().
      // If strict encoding control is needed for streams, the stream should yield Buffers.
      for (const hasher of hashers) {
        hasher.update(chunk);
      }
    }
  }

  const result: MultiHashResult = {};
  for (let i = 0; i < uniqueAlgorithms.length; i++) {
    result[uniqueAlgorithms[i]] = hashers[i].digest();
  }

  return result;
}

/**
 * Verify data against a formatted checksum (e.g. "sha256:abc...").
 * Automatically selects the algorithm from the checksum prefix.
 */
export async function verify(
  input: HashInput,
  checksum: string,
  encoding: BufferEncoding = "utf8",
): Promise<boolean> {
  const expected = Digest.parse(checksum);
  const result = await multiHash(input, [expected.algorithm], encoding);
  const actual = result[expected.algorithm];

  if (!actual) return false;
  return actual.algorithm === expected.algorithm && actual.hex === expected.hex;
}
