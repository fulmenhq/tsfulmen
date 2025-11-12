/**
 * DocScribe module public types.
 */

export type DocScribePrimitiveValue = string | number | boolean | null;

export type DocScribeMetadataValue =
  | DocScribePrimitiveValue
  | ReadonlyArray<DocScribeMetadataValue>
  | { readonly [key: string]: DocScribeMetadataValue };

export interface DocScribeMetadata extends Record<string, DocScribeMetadataValue | undefined> {
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
  readonly date?: string;
  readonly lastUpdated?: string;
  readonly status?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly version?: string;
  readonly relatedDocs?: ReadonlyArray<string>;
  readonly meta?: DocScribeMetadataValue;
}

export interface DocScribeFrontmatterResult {
  readonly metadata: DocScribeMetadata | null;
  readonly body: string;
  readonly range: {
    readonly start: number;
    readonly end: number;
  } | null;
  readonly bodyStartLine: number;
}

export interface DocScribeHeader {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
  readonly line: number;
}

export type DocScribeFormat = "markdown" | "yaml" | "yaml-stream" | "json" | "toml" | "plain";

export interface DocScribeInfo {
  readonly format: DocScribeFormat;
  readonly hasFrontmatter: boolean;
  readonly frontmatterRange: {
    readonly start: number;
    readonly end: number;
  } | null;
  readonly metadata: DocScribeMetadata | null;
  readonly headerCount: number;
  readonly estimatedSections: number;
  readonly bodyStartLine: number;
  readonly lineCount: number;
  readonly size: number;
  readonly headers: ReadonlyArray<DocScribeHeader>;
}

export interface DocScribeSplit {
  readonly content: string;
  readonly format: DocScribeFormat;
  readonly hasFrontmatter: boolean;
  readonly metadata: DocScribeMetadata | null;
  readonly startLine: number;
  readonly endLine: number;
  readonly index: number;
}

export interface DocScribeOptions {
  readonly maxDocuments?: number;
  readonly slugify?: (header: string) => string;
  readonly maxDepth?: number;
}

export class DocScribeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "DocScribeError";
  }
}

export class DocScribeParseError extends DocScribeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "DocScribeParseError";
  }
}

export class DocScribeUnsupportedFormatError extends DocScribeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "DocScribeUnsupportedFormatError";
  }
}
