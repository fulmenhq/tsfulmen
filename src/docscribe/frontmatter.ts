import { parseDocument } from 'yaml';

import { normalizeInput } from './normalize.js';
import {
  type DocScribeFrontmatterResult,
  type DocScribeMetadata,
  type DocScribeMetadataValue,
  DocScribeParseError,
} from './types.js';

const FRONTMATTER_DELIMITER = '---';
const STRING_KEYS = new Set<string>([
  'title',
  'description',
  'author',
  'date',
  'lastUpdated',
  'status',
  'version',
]);

interface FrontmatterBounds {
  readonly start: number;
  readonly openEnd: number;
  readonly closingStart: number;
  readonly closingEnd: number;
}

export function parseFrontmatter(
  input: string | Uint8Array | ArrayBufferLike,
): DocScribeFrontmatterResult {
  const { content } = normalizeInput(input);
  const bounds = locateFrontmatter(content);

  if (!bounds) {
    return { metadata: null, body: content, range: null, bodyStartLine: 1 };
  }

  const yamlBlock = content.slice(bounds.openEnd, bounds.closingStart);
  const metadata =
    yamlBlock.trim().length === 0 ? ({} as DocScribeMetadata) : parseYamlMetadata(yamlBlock);

  const bodyRaw = content.slice(bounds.closingEnd);
  const leadingNewlinesMatch = bodyRaw.match(/^\n+/);
  const leadingNewlinesLength = leadingNewlinesMatch ? leadingNewlinesMatch[0].length : 0;
  const bodyStartIndex = bounds.closingEnd + leadingNewlinesLength;
  const prefix = content.slice(0, bodyStartIndex);
  const bodyStartLine = prefix.length === 0 ? 1 : prefix.split('\n').length;
  const body = bodyRaw.slice(leadingNewlinesLength);

  return {
    metadata,
    body,
    range: { start: bounds.start, end: bounds.closingEnd },
    bodyStartLine,
  };
}

export function stripFrontmatter(input: string | Uint8Array | ArrayBufferLike): string {
  return parseFrontmatter(input).body;
}

export function extractMetadata(
  input: string | Uint8Array | ArrayBufferLike,
): DocScribeMetadata | null {
  return parseFrontmatter(input).metadata;
}

function locateFrontmatter(content: string): FrontmatterBounds | null {
  let cursor = 0;

  while (cursor < content.length) {
    const newlineIndex = content.indexOf('\n', cursor);
    const lineEnd = newlineIndex === -1 ? content.length : newlineIndex;
    const line = content.slice(cursor, lineEnd);

    if (line.trim().length === 0) {
      if (newlineIndex === -1) {
        return null;
      }
      cursor = newlineIndex + 1;
      continue;
    }

    if (line.trim() !== FRONTMATTER_DELIMITER) {
      return null;
    }

    const openStart = cursor;
    const openEnd = newlineIndex === -1 ? content.length : newlineIndex + 1;

    let search = openEnd;
    while (search <= content.length) {
      const nextNewline = content.indexOf('\n', search);
      const segmentEnd = nextNewline === -1 ? content.length : nextNewline;
      const candidate = content.slice(search, segmentEnd).trim();

      if (candidate === FRONTMATTER_DELIMITER) {
        const closingStart = search;
        const closingEnd = nextNewline === -1 ? segmentEnd : nextNewline + 1;
        return {
          start: openStart,
          openEnd,
          closingStart,
          closingEnd,
        };
      }

      if (nextNewline === -1) {
        break;
      }

      search = nextNewline + 1;
    }

    return null;
  }

  return null;
}

function parseYamlMetadata(source: string): DocScribeMetadata {
  const document = parseDocument(source, { prettyErrors: true });

  if (document.errors.length > 0) {
    const error = document.errors[0];
    const location = error.linePos && error.linePos.length > 0 ? error.linePos[0] : null;
    const position = location ? ` (line ${location.line + 1}, column ${location.col + 1})` : '';
    throw new DocScribeParseError(`Invalid YAML frontmatter${position}: ${error.message}`, {
      cause: error,
    });
  }

  let raw: unknown;
  try {
    raw = document.toJS({ mapAsMap: false });
  } catch (error) {
    throw new DocScribeParseError('Failed to parse YAML frontmatter', {
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (raw == null) {
    return {} as DocScribeMetadata;
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DocScribeParseError('YAML frontmatter must be a mapping at the top level');
  }

  return normalizeMetadata(raw as Record<string, unknown>);
}

function normalizeMetadata(raw: Record<string, unknown>): DocScribeMetadata {
  const normalized: Record<string, DocScribeMetadataValue | undefined> = {};

  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = normalizeMetadataValue(value);
  }

  const base: Record<string, DocScribeMetadataValue | undefined> = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (STRING_KEYS.has(key) || key === 'tags' || key === 'relatedDocs') {
      continue;
    }
    base[key] = value;
  }

  const metadata: DocScribeMetadata = {
    ...base,
    ...(normalized.title !== undefined ? { title: ensureStringValue(normalized.title) } : {}),
    ...(normalized.description !== undefined
      ? { description: ensureStringValue(normalized.description) }
      : {}),
    ...(normalized.author !== undefined ? { author: ensureStringValue(normalized.author) } : {}),
    ...(normalized.date !== undefined ? { date: ensureStringValue(normalized.date) } : {}),
    ...(normalized.lastUpdated !== undefined
      ? { lastUpdated: ensureStringValue(normalized.lastUpdated) }
      : {}),
    ...(normalized.status !== undefined ? { status: ensureStringValue(normalized.status) } : {}),
    ...(normalized.version !== undefined ? { version: ensureStringValue(normalized.version) } : {}),
    ...(normalized.tags !== undefined
      ? (() => {
          const tags = ensureStringArray(normalized.tags);
          return tags.length > 0 ? { tags } : {};
        })()
      : {}),
    ...(normalized.relatedDocs !== undefined
      ? (() => {
          const related = ensureStringArray(normalized.relatedDocs);
          return related.length > 0 ? { relatedDocs: related } : {};
        })()
      : {}),
  };

  return metadata;
}

function normalizeMetadataValue(value: unknown): DocScribeMetadataValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeMetadataValue(item),
    ) as ReadonlyArray<DocScribeMetadataValue>;
  }

  if (typeof value === 'object') {
    const result: Record<string, DocScribeMetadataValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeMetadataValue(nested);
    }
    return result as { readonly [key: string]: DocScribeMetadataValue };
  }

  return String(value);
}

function ensureStringValue(value: DocScribeMetadataValue): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => ensureStringArrayItem(item)).join(', ');
  }

  return JSON.stringify(value);
}

function ensureStringArray(value: DocScribeMetadataValue): ReadonlyArray<string> {
  return ensureStringArrayItem(value);
}

function ensureStringArrayItem(value: DocScribeMetadataValue): string[] {
  if (value === null) {
    return [];
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => ensureStringArrayItem(item));
  }

  return [JSON.stringify(value)];
}
