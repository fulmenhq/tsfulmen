import { describe, expect, it } from 'vitest';
import {
  Algorithm,
  DigestStateError,
  FulHashError,
  InvalidChecksumError,
  UnsupportedAlgorithmError,
} from '../index.js';
import type { Digest, HashOptions, StreamHasher, StreamHasherOptions } from '../types.js';

describe('Type Contracts', () => {
  describe('Algorithm enum', () => {
    it('should have XXH3_128 value', () => {
      expect(Algorithm.XXH3_128).toBe('xxh3-128');
    });

    it('should have SHA256 value', () => {
      expect(Algorithm.SHA256).toBe('sha256');
    });

    it('should have exactly 2 algorithms', () => {
      const algorithms = Object.values(Algorithm);
      expect(algorithms).toHaveLength(2);
      expect(algorithms).toContain('xxh3-128');
      expect(algorithms).toContain('sha256');
    });
  });

  describe('Digest interface', () => {
    it('should require algorithm, hex, bytes, and formatted properties', () => {
      const digest: Digest = {
        algorithm: Algorithm.SHA256,
        hex: 'abc123',
        bytes: new Uint8Array([0xab, 0xc1, 0x23]),
        formatted: 'sha256:abc123',
      };

      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.hex).toBe('abc123');
      expect(digest.bytes).toBeInstanceOf(Uint8Array);
      expect(digest.formatted).toBe('sha256:abc123');
    });
  });

  describe('HashOptions interface', () => {
    it('should allow optional algorithm override', () => {
      const options: HashOptions = {
        algorithm: Algorithm.SHA256,
      };
      expect(options.algorithm).toBe(Algorithm.SHA256);
    });

    it('should allow optional encoding', () => {
      const options: HashOptions = {
        encoding: 'utf8',
      };
      expect(options.encoding).toBe('utf8');
    });

    it('should allow empty options', () => {
      const options: HashOptions = {};
      expect(options).toBeDefined();
    });
  });

  describe('StreamHasher interface', () => {
    it('should define update, digest, and reset methods', () => {
      const mockHasher: StreamHasher = {
        update: (_data: string | Uint8Array) => mockHasher,
        digest: () => ({
          algorithm: Algorithm.XXH3_128,
          hex: 'test',
          bytes: new Uint8Array(),
          formatted: 'xxh3-128:test',
        }),
        reset: () => mockHasher,
      };

      expect(typeof mockHasher.update).toBe('function');
      expect(typeof mockHasher.digest).toBe('function');
      expect(typeof mockHasher.reset).toBe('function');
    });

    it('should allow update to be chainable', () => {
      const mockHasher: StreamHasher = {
        update: (_data: string | Uint8Array) => mockHasher,
        digest: () => ({
          algorithm: Algorithm.XXH3_128,
          hex: 'test',
          bytes: new Uint8Array(),
          formatted: 'xxh3-128:test',
        }),
        reset: () => mockHasher,
      };

      const result = mockHasher.update('test');
      expect(result).toBe(mockHasher);
    });
  });

  describe('StreamHasherOptions interface', () => {
    it('should allow optional algorithm', () => {
      const options: StreamHasherOptions = {
        algorithm: Algorithm.XXH3_128,
      };
      expect(options.algorithm).toBe(Algorithm.XXH3_128);
    });

    it('should allow empty options', () => {
      const options: StreamHasherOptions = {};
      expect(options).toBeDefined();
    });
  });

  describe('Error classes', () => {
    it('should have FulHashError as base class', () => {
      const error = new FulHashError('test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FulHashError);
      expect(error.name).toBe('FulHashError');
      expect(error.message).toBe('test error');
      expect(error.stack).toBeDefined();
    });

    it('should have UnsupportedAlgorithmError extending FulHashError', () => {
      const error = new UnsupportedAlgorithmError('md5', ['xxh3-128', 'sha256']);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FulHashError);
      expect(error).toBeInstanceOf(UnsupportedAlgorithmError);
      expect(error.name).toBe('UnsupportedAlgorithmError');
      expect(error.message).toContain('md5');
      expect(error.message).toContain('xxh3-128');
      expect(error.message).toContain('sha256');
    });

    it('should have InvalidChecksumError extending FulHashError', () => {
      const error = new InvalidChecksumError('invalid', 'missing separator');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FulHashError);
      expect(error).toBeInstanceOf(InvalidChecksumError);
      expect(error.name).toBe('InvalidChecksumError');
      expect(error.message).toContain('invalid');
      expect(error.message).toContain('missing separator');
    });

    it('should have DigestStateError extending FulHashError', () => {
      const error = new DigestStateError('update');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FulHashError);
      expect(error).toBeInstanceOf(DigestStateError);
      expect(error.name).toBe('DigestStateError');
      expect(error.message).toContain('update');
      expect(error.message).toContain('reset()');
    });
  });
});
