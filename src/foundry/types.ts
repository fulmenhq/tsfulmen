/**
 * Foundry module - TypeScript type definitions
 *
 * Core interfaces for pattern catalogs, HTTP statuses, MIME types, and country codes
 * aligned with Crucible Foundry Pattern Catalog standard.
 */

import type { Readable } from 'node:stream';

// Pattern Catalog Types
export interface PatternFlags {
  unicode?: boolean;
  ignoreCase?: boolean;
  global?: boolean;
  multiline?: boolean;
  dotAll?: boolean;
}

export interface LanguageFlags {
  typescript?: PatternFlags;
  python?: PatternFlags;
  go?: PatternFlags;
  rust?: PatternFlags;
  csharp?: PatternFlags;
}

export type PatternKind = 'regex' | 'glob' | 'literal';

export interface Pattern {
  id: string;
  name: string;
  kind: PatternKind;
  pattern: string;
  flags?: LanguageFlags;
  description?: string;
  examples?: string[];
}

export interface PatternCatalog {
  version: string;
  description: string;
  patterns: Pattern[];
}

// HTTP Status Types
export interface HttpStatusCode {
  value: number;
  reason: string;
  group: HttpStatusGroupId;
  description?: string;
}

export type HttpStatusGroupId =
  | 'informational'
  | 'success'
  | 'redirect'
  | 'client-error'
  | 'server-error';

export interface HttpStatusGroup {
  id: HttpStatusGroupId;
  name: string;
  description: string;
  codes: Array<{ value: number; reason: string; description?: string }>;
}

export interface HttpStatusCatalog {
  version: string;
  description: string;
  groups: HttpStatusGroup[];
}

// MIME Type Types
export interface MimeType {
  id: string;
  mime: string;
  name: string;
  extensions: string[];
  description?: string;
}

export interface MimeTypeCatalog {
  version: string;
  description: string;
  types: MimeType[];
}

// Country Code Types
export interface Country {
  alpha2: string; // ISO 3166-1 alpha-2 (2 letters)
  alpha3: string; // ISO 3166-1 alpha-3 (3 letters)
  numeric: string; // ISO 3166-1 numeric (3 digits)
  name: string;
  officialName?: string;
}

export interface CountryCatalog {
  version: string;
  description: string;
  countries: Country[];
}

// Detection Options (for MIME type detection)
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

// Utility Types
export type StreamInput = Buffer | ReadableStream | Readable;
export type FileInput = string | StreamInput;
