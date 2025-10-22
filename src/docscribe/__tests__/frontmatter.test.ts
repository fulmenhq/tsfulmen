import { describe, expect, it } from 'vitest';

import { extractMetadata, parseFrontmatter, stripFrontmatter } from '../frontmatter.ts';
import { DocScribeParseError } from '../types.ts';

const encoder = new TextEncoder();

describe('parseFrontmatter', () => {
  it('extracts metadata and body for standard frontmatter', () => {
    const input = '---\ntitle: Test Document\nstatus: draft\n---\n# Heading';
    const result = parseFrontmatter(input);

    expect(result.metadata).toMatchObject({
      title: 'Test Document',
      status: 'draft',
    });
    expect(result.body).toBe('# Heading');
    expect(result.range).toEqual({ start: 0, end: input.indexOf('#') });
    expect(result.bodyStartLine).toBe(5);
  });

  it('returns null metadata when no frontmatter is present', () => {
    const input = '# Heading\nContent';
    const result = parseFrontmatter(input);

    expect(result.metadata).toBeNull();
    expect(result.body).toBe(input);
    expect(result.range).toBeNull();
    expect(result.bodyStartLine).toBe(1);
  });

  it('handles empty frontmatter blocks', () => {
    const input = '---\n---\nBody';
    const result = parseFrontmatter(input);

    expect(result.metadata).toEqual({});
    expect(result.body).toBe('Body');
    expect(result.range).toEqual({ start: 0, end: 8 });
  });

  it('normalizes CRLF line endings', () => {
    const input = '---\r\ntitle: Windows\r\n---\r\nBody';
    const result = parseFrontmatter(input);

    expect(result.metadata).toMatchObject({ title: 'Windows' });
    expect(result.body).toBe('Body');
  });

  it('supports Uint8Array input', () => {
    const input = encoder.encode('---\ntitle: Encoded\n---\nBody');
    const result = parseFrontmatter(input);

    expect(result.metadata).toMatchObject({ title: 'Encoded' });
    expect(result.body).toBe('Body');
  });

  it('ignores content when closing delimiter is missing', () => {
    const input = '---\ntitle: Missing Close\nBody';
    const result = parseFrontmatter(input);

    expect(result.metadata).toBeNull();
    expect(result.body).toBe('---\ntitle: Missing Close\nBody');
  });

  it('accepts leading blank lines before frontmatter', () => {
    const input = '\n\n---\ntitle: Preface\n---\nContent';
    const result = parseFrontmatter(input);

    expect(result.metadata).toMatchObject({ title: 'Preface' });
    expect(result.body).toBe('Content');
    expect(result.bodyStartLine).toBe(6);
  });

  it('normalizes tags arrays', () => {
    const input = '---\ntags:\n  - alpha\n  - beta\nrelatedDocs: doc-1\n---\nContent';
    const result = parseFrontmatter(input);

    expect(result.metadata?.tags).toEqual(['alpha', 'beta']);
    expect(result.metadata?.relatedDocs).toEqual(['doc-1']);
  });

  it('preserves nested metadata objects', () => {
    const input = '---\nmeta:\n  nested: true\n---\nBody';
    const result = parseFrontmatter(input);

    expect(result.metadata?.meta).toEqual({ nested: true });
  });

  it('throws descriptive error for malformed YAML', () => {
    const input = '---\nkey: [unterminated\n---\nBody';

    expect(() => parseFrontmatter(input)).toThrowError(DocScribeParseError);
  });
});

describe('stripFrontmatter', () => {
  it('removes frontmatter and returns body', () => {
    const input = '---\nauthor: Jane\n---\n# Title';
    expect(stripFrontmatter(input)).toBe('# Title');
  });
});

describe('extractMetadata', () => {
  it('returns metadata object when present', () => {
    const input = '---\ntitle: Extract Test\n---\nContent';
    expect(extractMetadata(input)).toMatchObject({ title: 'Extract Test' });
  });

  it('returns null when no frontmatter exists', () => {
    expect(extractMetadata('Body')).toBeNull();
  });
});
