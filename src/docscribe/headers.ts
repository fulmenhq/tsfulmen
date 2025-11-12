import { parseFrontmatter } from "./frontmatter.js";
import { normalizeInput } from "./normalize.js";
import type { DocScribeHeader, DocScribeOptions } from "./types.js";

const ATX_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/;
const SETEXT_PATTERN = /^ {0,3}(=+|-+)\s*$/;

export function extractHeaders(
  input: string | Uint8Array | ArrayBufferLike,
  options?: DocScribeOptions,
): DocScribeHeader[] {
  const { content } = normalizeInput(input);
  const parsed = parseFrontmatter(content);
  const body = parsed.body;
  const lineOffset = parsed.bodyStartLine;

  const slugify = options?.slugify ?? defaultSlugify;
  const maxDepth = options?.maxDepth ?? 6;

  const lines = body.split("\n");
  const headers: DocScribeHeader[] = [];

  let inFence = false;
  let fenceMarker: "`" | "~" | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trimEnd();
    const lineNumber = lineOffset + index;

    const fenceMatch = line.match(/^ {0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (fenceMarker === marker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    if (/^( {4}|\t)/.test(line)) {
      continue;
    }

    const atxMatch = trimmed.match(ATX_PATTERN);
    if (atxMatch) {
      const level = atxMatch[1].length;
      if (level <= maxDepth) {
        const rawText = atxMatch[2].replace(/#+\s*$/, "").trim();
        const text = rawText.length > 0 ? rawText : "";
        const slug = ensureSlug(slugify, text, lineNumber);
        headers.push({ level, text, slug, line: lineNumber });
      }
      continue;
    }

    if (trimmed.length === 0) {
      continue;
    }

    if (index + 1 >= lines.length) {
      continue;
    }

    const nextLine = lines[index + 1];
    const setextMatch = SETEXT_PATTERN.exec(nextLine.trimEnd());
    if (setextMatch) {
      const underline = setextMatch[1];
      const level = underline.startsWith("=") ? 1 : 2;
      if (level <= maxDepth) {
        const text = trimmed.trim();
        if (text.length > 0 && !/^ {0,3}(```|~~~)/.test(text)) {
          const slug = ensureSlug(slugify, text, lineNumber);
          headers.push({ level, text, slug, line: lineNumber });
        }
      }
      index += 1;
    }
  }

  return headers;
}

function defaultSlugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function ensureSlug(slugify: (header: string) => string, text: string, lineNumber: number): string {
  const candidate = slugify(text);
  if (candidate && candidate.trim().length > 0) {
    return candidate;
  }
  return `section-${lineNumber}`;
}
