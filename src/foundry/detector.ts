/**
 * Foundry MIME Type Detector
 *
 * Pattern matching engine for content-based MIME type detection using
 * magic numbers and heuristic analysis.
 */

import {
  getBOMOffset,
  MAGIC_NUMBER_DATABASE,
  type MagicNumberPattern,
  type MagicNumberSignature,
} from './magic-numbers.js';
import type { MimeType } from './types.js';

export interface DetectionOptions {
  /**
   * Fall back to extension-based detection if magic number detection fails.
   * Default: true
   */
  fallbackToExtension?: boolean;

  /**
   * Number of bytes to read for magic number detection.
   * Default: 512
   */
  bytesToRead?: number;

  /**
   * File extension hint for fallback detection.
   * Useful when input is a Buffer without path context.
   */
  extensionHint?: string;
}

export class MimeTypeDetector {
  private patterns: MagicNumberSignature[];
  private catalog: Map<string, MimeType>;

  constructor(patterns: MagicNumberSignature[], catalog: Map<string, MimeType>) {
    this.patterns = [...patterns].sort((a, b) => b.priority - a.priority);
    this.catalog = catalog;
  }

  /**
   * Detect MIME type from buffer content
   */
  detect(buffer: Buffer, _options: DetectionOptions = {}): MimeType | null {
    // Skip BOM if present
    const offset = getBOMOffset(buffer);
    const workingBuffer = offset > 0 ? buffer.subarray(offset) : buffer;

    // Try patterns in priority order, regardless of strategy
    // This allows NDJSON heuristic to run before JSON exact match
    for (const pattern of this.patterns) {
      if (pattern.matchStrategy === 'exact' && this.matchPattern(workingBuffer, pattern)) {
        return this.catalog.get(pattern.mimeType) || null;
      }
      if (pattern.matchStrategy === 'heuristic' && this.matchHeuristic(workingBuffer, pattern)) {
        return this.catalog.get(pattern.mimeType) || null;
      }
    }

    return null;
  }

  /**
   * Match buffer against a pattern signature
   */
  private matchPattern(buffer: Buffer, signature: MagicNumberSignature): boolean {
    for (const pattern of signature.patterns) {
      if (this.matchBytes(buffer, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Match bytes at specified offset with optional masking
   */
  private matchBytes(buffer: Buffer, pattern: MagicNumberPattern): boolean {
    const { offset, bytes, mask } = pattern;

    if (buffer.length < offset + bytes.length) {
      return false;
    }

    for (let i = 0; i < bytes.length; i++) {
      const bufferByte = buffer[offset + i];
      const patternByte = bytes[i];
      const maskByte = mask ? mask[i] : 0xff;

      if ((bufferByte & maskByte) !== (patternByte & maskByte)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Heuristic detection for formats without magic numbers
   */
  private matchHeuristic(buffer: Buffer, signature: MagicNumberSignature): boolean {
    switch (signature.mimeType) {
      case 'application/x-ndjson':
        return this.detectNDJSON(buffer);
      case 'application/yaml':
        return this.detectYAML(buffer);
      case 'text/csv':
        return this.detectCSV(buffer);
      case 'application/x-protobuf':
        return this.detectProtobuf(buffer);
      case 'text/plain':
        return this.detectPlainText(buffer);
      default:
        return false;
    }
  }

  /**
   * Detect NDJSON (newline-delimited JSON)
   */
  private detectNDJSON(buffer: Buffer): boolean {
    try {
      const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 512));
      const lines = text.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length < 2) return false;

      // Check if at least first 2-3 lines are valid JSON
      const linesToCheck = Math.min(3, lines.length);
      let validJsonLines = 0;

      for (let i = 0; i < linesToCheck; i++) {
        try {
          JSON.parse(lines[i]);
          validJsonLines++;
        } catch {
          return false;
        }
      }

      return validJsonLines >= 2;
    } catch {
      return false;
    }
  }

  /**
   * Detect YAML format (heuristic for files without --- header)
   */
  private detectYAML(buffer: Buffer): boolean {
    try {
      const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 512));
      const lines = text.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length === 0) return false;

      // Count YAML-like patterns
      let yamlIndicators = 0;
      let nonYamlIndicators = 0;

      for (const line of lines.slice(0, 10)) {
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('#')) continue;

        // YAML key-value pattern: "key: value"
        if (/^[\w"'-]+\s*:\s*.+$/.test(trimmed)) {
          yamlIndicators++;
          continue;
        }

        // YAML list item: "- item"
        if (/^-\s+/.test(trimmed)) {
          yamlIndicators++;
          continue;
        }

        // JSON-like patterns suggest not YAML
        if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.endsWith(',')) {
          nonYamlIndicators++;
        }
      }

      // Require at least 2 YAML indicators and no JSON indicators
      return yamlIndicators >= 2 && nonYamlIndicators === 0;
    } catch {
      return false;
    }
  }

  /**
   * Detect CSV format
   */
  private detectCSV(buffer: Buffer): boolean {
    try {
      const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 512));
      const lines = text.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length < 2) return false;

      // Try common delimiters
      const delimiters = [',', ';', '\t'];

      for (const delimiter of delimiters) {
        const counts = lines.map((line) => {
          const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const matches = line.match(new RegExp(escaped, 'g'));
          return matches ? matches.length : 0;
        });

        // Check for consistent delimiter count across lines (and at least 1 delimiter)
        const firstCount = counts[0];
        if (firstCount > 0 && counts.every((count) => count === firstCount)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect protobuf binary format
   */
  private detectProtobuf(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // Protobuf messages typically start with field tags
    // Field tag = (field_number << 3) | wire_type
    // Wire types: 0 (varint), 1 (64-bit), 2 (length-delimited), 5 (32-bit)

    const firstByte = buffer[0];
    const wireType = firstByte & 0x07;
    const fieldNumber = firstByte >> 3;

    // Valid wire type (0-5, excluding 3 and 4 which are deprecated)
    const hasValidWireType = wireType === 0 || wireType === 1 || wireType === 2 || wireType === 5;

    // Reasonable field number (1-99)
    const hasValidFieldNumber = fieldNumber > 0 && fieldNumber < 100;

    // Check if content is binary (not text)
    const isBinary = this.isBinaryContent(buffer);

    // All three conditions must be met
    return hasValidWireType && hasValidFieldNumber && isBinary;
  }

  /**
   * Detect plain text format
   */
  private detectPlainText(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));

    // Reject empty buffers
    if (sample.length === 0) return false;

    let binaryBytes = 0;

    for (const byte of sample) {
      // Count null bytes and non-printable characters (excluding common whitespace)
      if (byte === 0x00 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)) {
        binaryBytes++;
      }
    }

    // If less than 5% binary bytes, likely text (stricter threshold)
    return binaryBytes / sample.length < 0.05;
  }

  /**
   * Check if buffer contains binary content
   */
  private isBinaryContent(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    let binaryBytes = 0;

    for (const byte of sample) {
      if (byte === 0x00 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)) {
        binaryBytes++;
      }
    }

    // More than 10% binary bytes indicates binary content
    return binaryBytes / sample.length > 0.1;
  }
}

/**
 * Create a detector instance with the global magic number database
 */
export function createDetector(catalog: Map<string, MimeType>): MimeTypeDetector {
  return new MimeTypeDetector(MAGIC_NUMBER_DATABASE, catalog);
}
