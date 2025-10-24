/**
 * Block hashing helpers for one-shot hashing operations
 */

import * as sha256 from './algorithms/sha256.js';
import * as xxh3 from './algorithms/xxh3.js';
import { Digest } from './digest.js';
import { UnsupportedAlgorithmError } from './errors.js';
import { Algorithm, type HashOptions } from './types.js';

export async function hash(input: string | Uint8Array, options?: HashOptions): Promise<Digest> {
  const algorithm = options?.algorithm ?? Algorithm.XXH3_128;
  const encoding = options?.encoding ?? 'utf8';

  let bytes: Uint8Array;

  if (algorithm === Algorithm.SHA256) {
    if (typeof input === 'string') {
      bytes = sha256.hashString(input, encoding);
    } else {
      bytes = sha256.hashBytes(input);
    }
  } else if (algorithm === Algorithm.XXH3_128) {
    if (typeof input === 'string') {
      bytes = await xxh3.hashString(input, 'utf8');
    } else {
      bytes = await xxh3.hashBytes(input);
    }
  } else {
    throw new UnsupportedAlgorithmError(algorithm, [Algorithm.SHA256, Algorithm.XXH3_128]);
  }

  return new Digest(algorithm, bytes);
}

export async function hashString(str: string, options?: HashOptions): Promise<Digest> {
  return hash(str, options);
}

export async function hashBytes(data: Uint8Array, options?: HashOptions): Promise<Digest> {
  return hash(data, options);
}
