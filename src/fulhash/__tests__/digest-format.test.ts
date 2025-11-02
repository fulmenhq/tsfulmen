import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { Digest } from '../digest.js';
import { hash } from '../hash.js';
import { Algorithm, type FixturesFile } from '../types.js';

const FIXTURES_PATH = join(process.cwd(), 'config/crucible-ts/library/fulhash/fixtures.yaml');

describe('Digest Formatting', () => {
  describe('Format Generation', () => {
    it('should format SHA-256 digest correctly', async () => {
      const result = await hash('test', { algorithm: Algorithm.SHA256 });
      expect(result.formatted).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(result.formatted).toBe(`sha256:${result.hex}`);
    });

    it('should format XXH3-128 digest correctly', async () => {
      const result = await hash('test', { algorithm: Algorithm.XXH3_128 });
      expect(result.formatted).toMatch(/^xxh3-128:[0-9a-f]{32}$/);
      expect(result.formatted).toBe(`xxh3-128:${result.hex}`);
    });

    it('should use lowercase hexadecimal', async () => {
      const result = await hash('test');
      expect(result.hex).toBe(result.hex.toLowerCase());
      expect(result.formatted).toBe(result.formatted.toLowerCase());
    });

    it('should be immutable', async () => {
      const result = await hash('test');
      const originalFormatted = result.formatted;

      expect(() => {
        Reflect.set(result, 'formatted', 'modified');
      }).toThrow();

      expect(result.formatted).toBe(originalFormatted);
    });
  });

  describe('Digest Parsing', () => {
    it('should parse valid SHA-256 checksum', () => {
      const checksum = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const digest = Digest.parse(checksum);

      expect(digest.algorithm).toBe(Algorithm.SHA256);
      expect(digest.hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(digest.formatted).toBe(checksum);
    });

    it('should parse valid XXH3-128 checksum', () => {
      const checksum = 'xxh3-128:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const digest = Digest.parse(checksum);

      expect(digest.algorithm).toBe(Algorithm.XXH3_128);
      expect(digest.hex).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
      expect(digest.formatted).toBe(checksum);
    });

    it('should reject checksum without separator', () => {
      expect(() => {
        Digest.parse('invalidnoseparator');
      }).toThrow('Invalid checksum');
      expect(() => {
        Digest.parse('invalidnoseparator');
      }).toThrow('missing separator');
    });

    it('should reject unknown algorithm', () => {
      expect(() => {
        Digest.parse('unknown:abc123def456');
      }).toThrow('Unsupported algorithm');
      expect(() => {
        Digest.parse('unknown:abc123def456');
      }).toThrow('unknown');
    });

    it('should reject uppercase hexadecimal', () => {
      expect(() => {
        Digest.parse('sha256:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
      }).toThrow('lowercase hexadecimal');
    });

    it('should reject invalid hex characters', () => {
      expect(() => {
        Digest.parse('sha256:not-valid-hex-string-with-dashes-and-letters-zzz');
      }).toThrow('lowercase hexadecimal');
    });

    it('should reject wrong hex length for SHA-256', () => {
      expect(() => {
        Digest.parse('sha256:abc123'); // Too short
      }).toThrow('invalid hex length');
      expect(() => {
        Digest.parse('sha256:abc123');
      }).toThrow('expected 64');
    });

    it('should reject wrong hex length for XXH3-128', () => {
      expect(() => {
        Digest.parse('xxh3-128:abc123'); // Too short
      }).toThrow('invalid hex length');
      expect(() => {
        Digest.parse('xxh3-128:abc123');
      }).toThrow('expected 32');
    });

    it('should handle empty parts', () => {
      expect(() => {
        Digest.parse(':abc123');
      }).toThrow('Invalid checksum');

      expect(() => {
        Digest.parse('sha256:');
      }).toThrow('Invalid checksum');
    });
  });

  describe('Digest Equality', () => {
    it('should return true for identical digests', async () => {
      const digest1 = await hash('test');
      const digest2 = await hash('test');

      expect(digest1.equals(digest2)).toBe(true);
    });

    it('should return false for different hashes', async () => {
      const digest1 = await hash('test1');
      const digest2 = await hash('test2');

      expect(digest1.equals(digest2)).toBe(false);
    });

    it('should return false for different algorithms', async () => {
      const digest1 = await hash('test', { algorithm: Algorithm.SHA256 });
      const digest2 = await hash('test', { algorithm: Algorithm.XXH3_128 });

      expect(digest1.equals(digest2)).toBe(false);
    });

    it('should work with parsed digests', async () => {
      const original = await hash('test');
      const parsed = Digest.parse(original.formatted);

      expect(parsed.equals(original)).toBe(true);
    });
  });

  describe('Checksum Verification', () => {
    it('should verify correct checksum for string input', async () => {
      const data = 'test data';
      const digest = await hash(data);

      const isValid = await Digest.verify(data, digest.formatted);
      expect(isValid).toBe(true);
    });

    it('should verify correct checksum for byte input', async () => {
      const data = new TextEncoder().encode('test data');
      const digest = await hash(data);

      const isValid = await Digest.verify(data, digest.formatted);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect checksum', async () => {
      const data = 'test data';
      const wrongChecksum =
        'sha256:0000000000000000000000000000000000000000000000000000000000000000';

      const isValid = await Digest.verify(data, wrongChecksum);
      expect(isValid).toBe(false);
    });

    it('should handle different algorithms in verification', async () => {
      const data = 'test';
      const xxh3Digest = await hash(data, { algorithm: Algorithm.XXH3_128 });
      const sha256Digest = await hash(data, { algorithm: Algorithm.SHA256 });

      expect(await Digest.verify(data, xxh3Digest.formatted)).toBe(true);
      expect(await Digest.verify(data, sha256Digest.formatted)).toBe(true);
    });
  });

  describe('Format Fixtures', () => {
    const content = readFileSync(FIXTURES_PATH, 'utf-8');
    const fixtures: FixturesFile = parse(content);

    if (!fixtures.format_fixtures) {
      it.skip('no format fixtures available', () => {});
      return;
    }

    for (const fixture of fixtures.format_fixtures) {
      if (fixture.algorithm && fixture.hex && fixture.expected_formatted) {
        const { algorithm, hex, expected_formatted: expectedFormatted } = fixture;

        it(`should format ${fixture.name} correctly`, () => {
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
          }

          const digest = new Digest(algorithm as Algorithm, bytes);
          expect(digest.formatted).toBe(expectedFormatted);
        });
      }

      if (fixture.formatted && fixture.expected_algorithm && fixture.expected_hex) {
        const {
          formatted,
          expected_algorithm: expectedAlgorithm,
          expected_hex: expectedHex,
        } = fixture;

        it(`should parse ${fixture.name} correctly`, () => {
          const digest = Digest.parse(formatted);

          expect(digest.algorithm).toBe(expectedAlgorithm);
          expect(digest.hex).toBe(expectedHex);
        });
      }
    }
  });

  describe('Error Fixtures', () => {
    const content = readFileSync(FIXTURES_PATH, 'utf-8');
    const fixtures: FixturesFile = parse(content);

    if (!fixtures.error_fixtures) {
      it.skip('no error fixtures available', () => {});
      return;
    }

    for (const fixture of fixtures.error_fixtures) {
      if (fixture.checksum) {
        const {
          checksum,
          expected_error: expectedError,
          error_message_contains: substrings,
        } = fixture;

        it(`should throw ${expectedError} for ${fixture.name}`, () => {
          expect(() => {
            Digest.parse(checksum);
          }).toThrow();

          try {
            Digest.parse(checksum);
          } catch (error) {
            const err = error as Error;
            expect(err.name).toBe(expectedError);

            for (const substring of substrings) {
              expect(err.message.toLowerCase()).toContain(substring.toLowerCase());
            }
          }
        });
      }
    }
  });

  describe('toString() and toJSON()', () => {
    it('should convert to string via toString()', async () => {
      const digest = await hash('test');
      expect(digest.toString()).toBe(digest.formatted);
    });

    it('should serialize to JSON', async () => {
      const digest = await hash('test');
      const json = digest.toJSON();

      expect(json).toEqual({
        algorithm: digest.algorithm,
        hex: digest.hex,
        formatted: digest.formatted,
      });
    });

    it('should work with JSON.stringify', async () => {
      const digest = await hash('test');
      const jsonString = JSON.stringify(digest);
      const parsed = JSON.parse(jsonString);

      expect(parsed.algorithm).toBe(digest.algorithm);
      expect(parsed.hex).toBe(digest.hex);
      expect(parsed.formatted).toBe(digest.formatted);
    });
  });
});
