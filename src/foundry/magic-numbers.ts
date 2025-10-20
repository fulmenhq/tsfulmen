/**
 * Foundry MIME Type Magic Number Database
 *
 * Defines byte patterns (magic numbers) for content-based MIME type detection.
 * Patterns are ordered by priority for accurate multi-format detection.
 */

export interface MagicNumberPattern {
  offset: number;
  bytes: number[];
  mask?: number[];
  description: string;
}

export type MatchStrategy = 'exact' | 'heuristic';

export interface MagicNumberSignature {
  mimeType: string;
  patterns: MagicNumberPattern[];
  priority: number;
  matchStrategy: MatchStrategy;
}

// UTF-8 BOM (Byte Order Mark)
export const UTF8_BOM: number[] = [0xef, 0xbb, 0xbf];

// XML Patterns (Priority 10 - Most specific)
const XML_PATTERNS: MagicNumberPattern[] = [
  {
    offset: 0,
    bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c],
    description: 'XML declaration: <?xml',
  },
  {
    offset: 0,
    bytes: [0xef, 0xbb, 0xbf, 0x3c, 0x3f, 0x78, 0x6d, 0x6c],
    description: 'XML with UTF-8 BOM: BOM + <?xml',
  },
];

// JSON Patterns (Priority 9)
const JSON_PATTERNS: MagicNumberPattern[] = [
  {
    offset: 0,
    bytes: [0x7b],
    description: 'JSON object start: {',
  },
  {
    offset: 0,
    bytes: [0x5b],
    description: 'JSON array start: [',
  },
  {
    offset: 0,
    bytes: [0xef, 0xbb, 0xbf, 0x7b],
    description: 'JSON object with BOM: BOM + {',
  },
  {
    offset: 0,
    bytes: [0xef, 0xbb, 0xbf, 0x5b],
    description: 'JSON array with BOM: BOM + [',
  },
];

// YAML Patterns (Priority 8)
const YAML_PATTERNS: MagicNumberPattern[] = [
  {
    offset: 0,
    bytes: [0x2d, 0x2d, 0x2d],
    description: 'YAML document marker: ---',
  },
  {
    offset: 0,
    bytes: [0x25, 0x59, 0x41, 0x4d, 0x4c],
    description: 'YAML directive: %YAML',
  },
];

// NDJSON Patterns (Priority 7 - Heuristic only)
const NDJSON_PATTERNS: MagicNumberPattern[] = [];

// CSV Patterns (Priority 6 - Heuristic only)
const CSV_PATTERNS: MagicNumberPattern[] = [];

// Protobuf Patterns (Priority 5 - Heuristic only)
const PROTOBUF_PATTERNS: MagicNumberPattern[] = [];

// Plain Text Patterns (Priority 1 - Fallback, heuristic)
const TEXT_PATTERNS: MagicNumberPattern[] = [];

/**
 * Magic Number Database
 *
 * Ordered by detection priority (highest first).
 * Note: Heuristic detection runs BEFORE exact pattern matching
 * for formats that can be ambiguous (NDJSON vs JSON).
 */
export const MAGIC_NUMBER_DATABASE: MagicNumberSignature[] = [
  {
    mimeType: 'application/xml',
    patterns: XML_PATTERNS,
    priority: 10,
    matchStrategy: 'exact',
  },
  {
    mimeType: 'application/x-ndjson',
    patterns: NDJSON_PATTERNS,
    priority: 9,
    matchStrategy: 'heuristic',
  },
  {
    mimeType: 'application/json',
    patterns: JSON_PATTERNS,
    priority: 8,
    matchStrategy: 'exact',
  },
  {
    mimeType: 'application/yaml',
    patterns: YAML_PATTERNS,
    priority: 7,
    matchStrategy: 'exact',
  },
  {
    mimeType: 'text/csv',
    patterns: CSV_PATTERNS,
    priority: 6,
    matchStrategy: 'heuristic',
  },
  {
    mimeType: 'application/x-protobuf',
    patterns: PROTOBUF_PATTERNS,
    priority: 5,
    matchStrategy: 'heuristic',
  },
  {
    mimeType: 'text/plain',
    patterns: TEXT_PATTERNS,
    priority: 1,
    matchStrategy: 'heuristic',
  },
];

/**
 * Check if buffer starts with UTF-8 BOM
 */
export function hasBOM(buffer: Buffer): boolean {
  if (buffer.length < 3) return false;
  return buffer[0] === UTF8_BOM[0] && buffer[1] === UTF8_BOM[1] && buffer[2] === UTF8_BOM[2];
}

/**
 * Get offset to skip BOM if present
 */
export function getBOMOffset(buffer: Buffer): number {
  return hasBOM(buffer) ? 3 : 0;
}
