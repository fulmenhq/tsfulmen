import type { Algorithm, Digest } from "../crucible/fulhash/types.js";

export interface HashOptions {
  algorithm?: Algorithm;
  encoding?: BufferEncoding;
}

export interface StreamHasher {
  update(data: string | Uint8Array): StreamHasher;
  digest(): Digest;
  reset(): StreamHasher;
}

export interface StreamHasherOptions {
  algorithm?: Algorithm;
}
