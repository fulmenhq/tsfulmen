/**
 * Type definitions for FulHash hashing module
 */

export enum Algorithm {
  XXH3_128 = 'xxh3-128',
  SHA256 = 'sha256',
}

export interface HashOptions {
  algorithm?: Algorithm;
  encoding?: BufferEncoding;
}

export interface Digest {
  algorithm: Algorithm;
  hex: string;
  bytes: Uint8Array;
  formatted: string;
}

export interface StreamHasherOptions {
  algorithm?: Algorithm;
}

export interface StreamHasher {
  update(data: string | Uint8Array): StreamHasher;
  digest(): Digest;
  reset(): StreamHasher;
}

export interface Fixture {
  name: string;
  description?: string;
  input?: string;
  input_bytes?: number[];
  encoding: string;
  xxh3_128: string;
  sha256: string;
  notes?: string;
}

export interface StreamingFixture {
  name: string;
  description?: string;
  chunks: Array<{
    value?: string;
    encoding?: string;
    size?: number;
    pattern?: string;
  }>;
  expected_xxh3_128: string;
  expected_sha256: string;
  notes?: string;
}

export interface ErrorFixture {
  name: string;
  input?: string;
  algorithm?: string;
  checksum?: string;
  expected_error: string;
  error_message_contains: string[];
}

export interface FormatFixture {
  name: string;
  algorithm?: string;
  hex?: string;
  formatted?: string;
  expected_formatted?: string;
  expected_algorithm?: string;
  expected_hex?: string;
}

export interface FixturesFile {
  version: string;
  description: string;
  fixtures: Fixture[];
  streaming_fixtures?: StreamingFixture[];
  error_fixtures?: ErrorFixture[];
  format_fixtures?: FormatFixture[];
  notes?: string;
}
