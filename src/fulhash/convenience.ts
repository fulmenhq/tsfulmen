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
): Promise<MultiHashResult> {
  const hashers: StreamHasher[] = await Promise.all(
    algorithms.map((algo) => createStreamHasher({ algorithm: algo })),
  );

  if (typeof input === "string" || input instanceof Uint8Array) {
    for (const hasher of hashers) {
      hasher.update(input);
    }
  } else {
    // AsyncIterable (Stream)
    for await (const chunk of input) {
      for (const hasher of hashers) {
        hasher.update(chunk);
      }
    }
  }

  const result: MultiHashResult = {};
  for (let i = 0; i < algorithms.length; i++) {
    result[algorithms[i]] = hashers[i].digest();
  }

  return result;
}

/**
 * Verify data against a formatted checksum (e.g. "sha256:abc...").
 * Automatically selects the algorithm from the checksum prefix.
 */
export async function verify(input: HashInput, checksum: string): Promise<boolean> {
  const expected = Digest.parse(checksum);
  const result = await multiHash(input, [expected.algorithm]);
  const actual = result[expected.algorithm];
  return actual.algorithm === expected.algorithm && actual.hex === expected.hex;
}
