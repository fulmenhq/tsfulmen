import { parseFrontmatter } from './frontmatter.js';
import { extractHeaders } from './headers.js';
import { normalizeInput } from './normalize.js';
import type { DocScribeFormat, DocScribeInfo, DocScribeOptions } from './types.js';

const JSON_PATTERN = /^[\s\t]*[[{]/;
const TOML_ASSIGNMENT = /^[A-Za-z0-9_"'\-.]+\s*=\s*.+$/;
const TOML_TABLE = /^\s*\[[^\]]+\]\s*$/;
const YAML_KEY_PATTERN = /^\s*[\w"'-]+\s*:\s*.+$/;
const MARKDOWN_HEADING = /(\n|^)\s{0,3}#{1,6}\s+/;
const MARKDOWN_LIST = /(\n|^)\s{0,3}(?:-|\*|\+)\s+/;
const MARKDOWN_SETEXT = /(\n|^).+\n\s{0,3}(?:=+|-+)\s*(\n|$)/;

export function detectFormat(input: string | Uint8Array | ArrayBufferLike): DocScribeFormat {
  const { content } = normalizeInput(input);
  return detectFormatFromContent(content);
}

export function inspectDocument(
  input: string | Uint8Array | ArrayBufferLike,
  options?: DocScribeOptions,
): DocScribeInfo {
  const { content } = normalizeInput(input);
  const format = detectFormatFromContent(content);
  const frontmatter = parseFrontmatter(content);
  const headers = extractHeaders(content, options);
  const headerCount = headers.length;
  const estimatedSections =
    headerCount > 0 ? headerCount : frontmatter.body.trim().length > 0 ? 1 : 0;
  const lineCount = content.length === 0 ? 0 : content.split('\n').length;
  const size = content.length;

  return {
    format,
    hasFrontmatter: frontmatter.metadata !== null,
    frontmatterRange: frontmatter.range,
    metadata: frontmatter.metadata,
    headerCount,
    estimatedSections,
    bodyStartLine: frontmatter.bodyStartLine,
    lineCount,
    size,
    headers,
  };
}

function detectFormatFromContent(content: string): DocScribeFormat {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return 'plain';
  }

  if (looksLikeJson(trimmed)) {
    return 'json';
  }

  if (looksLikeToml(trimmed)) {
    return 'toml';
  }

  const yamlSeparatorCount = countYamlSeparators(content);
  if (yamlSeparatorCount >= 2 && isLikelyYamlStream(content)) {
    return 'yaml-stream';
  }

  const markdownIndicators = hasMarkdownIndicators(content);

  if (looksLikeYaml(trimmed) && !markdownIndicators) {
    return 'yaml';
  }

  const frontmatter = parseFrontmatter(content);
  if (frontmatter.metadata !== null) {
    const body = frontmatter.body.trim();
    if (markdownIndicators || MARKDOWN_HEADING.test(body) || MARKDOWN_LIST.test(body)) {
      return 'markdown';
    }
    if (!body) {
      return 'markdown';
    }
  }

  if (markdownIndicators) {
    return 'markdown';
  }

  return 'plain';
}

function looksLikeJson(trimmed: string): boolean {
  if (!JSON_PATTERN.test(trimmed)) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch (_error) {
    return false;
  }
}

function looksLikeToml(content: string): boolean {
  const lines = content.split('\n');
  let tableCount = 0;
  let assignmentCount = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    if (TOML_TABLE.test(line)) {
      tableCount += 1;
      continue;
    }
    if (TOML_ASSIGNMENT.test(line)) {
      assignmentCount += 1;
    }
  }
  return tableCount > 0 || assignmentCount >= 3;
}

function looksLikeYaml(trimmed: string): boolean {
  if (trimmed.startsWith('%YAML')) {
    return true;
  }
  const lines = trimmed.split('\n');
  let signal = 0;
  for (const raw of lines.slice(0, 20)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    if (line === '---') {
      signal += 1;
      continue;
    }
    if (YAML_KEY_PATTERN.test(line) || /^-\s/.test(line)) {
      signal += 1;
    }
  }
  return signal >= 2;
}

function countYamlSeparators(content: string): number {
  const matches = content.match(/(^|\n)---\s*(\n|$)/g);
  return matches ? matches.length : 0;
}

function isLikelyYamlStream(content: string): boolean {
  const lines = content.split('\n');
  let yamlSignals = 0;
  let markdownSignals = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line === '---') {
      continue;
    }

    if (
      /^#/.test(line) ||
      /^\s{0,3}(?:-|\*|\+)\s+/.test(line) ||
      /(\[[^\]]+\]\([^)]+\))/.test(line)
    ) {
      markdownSignals += 1;
    }

    if (/:\s/.test(line) || /^-\s/.test(line)) {
      yamlSignals += 1;
    }
  }

  return yamlSignals >= 2 && markdownSignals === 0;
}

function hasMarkdownIndicators(content: string): boolean {
  return (
    MARKDOWN_HEADING.test(content) ||
    MARKDOWN_LIST.test(content) ||
    MARKDOWN_SETEXT.test(content) ||
    /(\n|^)\s{0,3}>\s+/.test(content) ||
    /(\[[^\]]+\]\([^)]+\))/.test(content)
  );
}

// Internal helper exported for testing or reuse
export const __internal = {
  detectFormatFromContent,
  looksLikeJson,
  looksLikeToml,
  looksLikeYaml,
  isLikelyYamlStream,
};
