/**
 * SHA-256 algorithm adapter using Node.js crypto module
 */

import { createHash } from 'node:crypto';

export function hashBytes(data: Uint8Array): Uint8Array {
  const hash = createHash('sha256');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

export function hashString(str: string, encoding: BufferEncoding = 'utf8'): Uint8Array {
  const hash = createHash('sha256');
  hash.update(str, encoding);
  return new Uint8Array(hash.digest());
}
