import { detectFormat } from './format.js';
import { parseFrontmatter } from './frontmatter.js';
import { normalizeInput } from './normalize.js';
import type { DocScribeFormat, DocScribeOptions, DocScribeSplit } from './types.js';

type RawSplit = Omit<DocScribeSplit, 'index'>;

type LineInfo = { line: string; lineNumber: number };

type AccumulatedDoc = { lines: string[]; startLine: number };

export function splitDocuments(
  input: string | Uint8Array | ArrayBufferLike,
  options?: DocScribeOptions,
): DocScribeSplit[] {
  const { content } = normalizeInput(input);
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const maxDocuments = options?.maxDocuments ?? Number.POSITIVE_INFINITY;
  const format = detectFormat(content);

  let splits: DocScribeSplit[];
  if (format === 'yaml-stream') {
    splits = withIndices(splitYamlStream(content));
  } else if (format === 'markdown') {
    const markdownSplits = splitMarkdownDocuments(content);
    splits =
      markdownSplits.length > 0
        ? withIndices(markdownSplits)
        : [withIndex(buildSingleSplit(content, format, 1), 0)];
  } else {
    splits = [withIndex(buildSingleSplit(content, format, 1), 0)];
  }

  return applyDocumentLimit(splits, maxDocuments);
}

function splitYamlStream(content: string): RawSplit[] {
  const lines = content.split('\n');
  const docs: AccumulatedDoc[] = [];
  let current: AccumulatedDoc = { lines: [], startLine: 1 };
  let delimiterCount = 0;

  const flush = () => {
    if (current.lines.join('\n').trim().length === 0) {
      current = { lines: [], startLine: current.startLine };
      return;
    }
    docs.push({ ...current, lines: [...current.lines] });
    current = { lines: [], startLine: current.startLine };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === '---') {
      delimiterCount += 1;
      flush();
      current = { lines: [], startLine: lineNumber + 1 };
      continue;
    }

    if (delimiterCount === 0) {
      current.startLine = 1;
    }

    current.lines.push(line);
  }

  flush();

  if (docs.length === 0) {
    return [buildRawSplit(content, 'yaml', null, 1, content.split('\n').length)];
  }

  return docs
    .map((doc) => {
      const joined = doc.lines.join('\n');
      const lineCount = doc.lines.length;
      return buildRawSplit(
        joined,
        'yaml',
        null,
        doc.startLine,
        doc.startLine + Math.max(lineCount - 1, 0),
      );
    })
    .filter((split) => split.content.trim().length > 0);
}

function splitMarkdownDocuments(content: string): RawSplit[] {
  const frontmatter = parseFrontmatter(content);
  const lines = content.split('\n');
  const docs: AccumulatedDoc[] = [];
  const frontmatterLimit = frontmatter.metadata ? Math.max(frontmatter.bodyStartLine - 1, 0) : 0;

  let current: AccumulatedDoc = { lines: [], startLine: 1 };
  let inFence = false;
  let fenceMarker: '`' | '~' | null = null;

  const flush = () => {
    if (current.lines.join('\n').trim().length === 0) {
      current = { lines: [], startLine: current.startLine };
      return;
    }
    docs.push({ ...current, lines: [...current.lines] });
    current = { lines: [], startLine: current.startLine };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmed = line.trimEnd();

    const fenceMatch = line.match(/^ {0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as '`' | '~';
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
      }
    }

    const isPrimaryFrontmatter = frontmatterLimit > 0 && lineNumber <= frontmatterLimit;

    if (!inFence && !isPrimaryFrontmatter && trimmed === '---') {
      const prev = findPrevNonEmpty(lines, index - 1);
      const next = findNextNonEmpty(lines, index + 1);
      const prevLooksLikeMetadata = prev ? /:\s*/.test(prev.line) : false;
      const nextIsHeading = next ? next.line.trim().startsWith('#') : false;

      if (next && !prevLooksLikeMetadata && nextIsHeading) {
        flush();
        current = { lines: [], startLine: next.lineNumber };
        continue;
      }
    }

    current.lines.push(line);
  }

  flush();

  return docs
    .map((doc) => {
      const contentValue = doc.lines.join('\n');
      const parsed = parseFrontmatter(contentValue);
      const lineCount = doc.lines.length;
      return buildRawSplit(
        contentValue,
        'markdown',
        parsed.metadata,
        doc.startLine,
        doc.startLine + Math.max(lineCount - 1, 0),
        parsed.metadata !== null,
      );
    })
    .filter((split) => split.content.trim().length > 0);
}

function buildSingleSplit(content: string, format: DocScribeFormat, startLine: number): RawSplit {
  const parsed = parseFrontmatter(content);
  const lineCount = content.length === 0 ? 0 : content.split('\n').length;
  return buildRawSplit(
    content,
    format,
    parsed.metadata,
    startLine,
    startLine + Math.max(lineCount - 1, 0),
    parsed.metadata !== null,
  );
}

function buildRawSplit(
  content: string,
  format: DocScribeFormat,
  metadata: ReturnType<typeof parseFrontmatter>['metadata'],
  startLine: number,
  endLine: number,
  hasFrontmatter = false,
): RawSplit {
  return {
    content,
    format,
    hasFrontmatter,
    metadata: metadata ?? null,
    startLine,
    endLine,
  };
}

function applyDocumentLimit(splits: DocScribeSplit[], maxDocuments: number): DocScribeSplit[] {
  if (maxDocuments <= 0) {
    return [];
  }

  if (splits.length <= maxDocuments) {
    return splits.map((split, idx) => ({ ...split, index: idx }));
  }

  const cutoff = Math.max(maxDocuments - 1, 0);
  const allowed = splits.slice(0, cutoff);
  const remaining = splits.slice(cutoff);
  const merged = mergeSplitGroup(remaining);
  const combined = cutoff === 0 ? [merged] : [...allowed, merged];
  return combined.map((split, idx) => ({ ...split, index: idx }));
}

function mergeSplitGroup(splits: DocScribeSplit[]): DocScribeSplit {
  const first = splits[0];
  const last = splits[splits.length - 1];
  const combinedContent = splits.map((split) => split.content).join('\n---\n');
  return {
    content: combinedContent,
    format: first.format,
    hasFrontmatter: first.hasFrontmatter,
    metadata: first.metadata,
    startLine: first.startLine,
    endLine: last.endLine,
    index: 0,
  };
}

function withIndices(rawSplits: RawSplit[]): DocScribeSplit[] {
  return rawSplits.map((split, idx) => withIndex(split, idx));
}

function withIndex(split: RawSplit, index: number): DocScribeSplit {
  return { ...split, index };
}

function findNextNonEmpty(lines: readonly string[], startIndex: number): LineInfo | null {
  for (let index = startIndex; index < lines.length; index += 1) {
    const candidate = lines[index];
    if (candidate.trim().length === 0) {
      continue;
    }
    return { line: candidate, lineNumber: index + 1 };
  }
  return null;
}

function findPrevNonEmpty(lines: readonly string[], startIndex: number): LineInfo | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    const candidate = lines[index];
    if (candidate.trim().length === 0) {
      continue;
    }
    return { line: candidate, lineNumber: index + 1 };
  }
  return null;
}
