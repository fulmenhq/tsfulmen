import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { parse as parseYAML } from 'yaml';
import { ExportErrorReason, SchemaExportError } from '../errors.js';
import { exportSchema, stripProvenance } from '../export.js';

const TEST_OUT_DIR = join(tmpdir(), `schema-export-tests-${Date.now()}`);

// Expected versions read from actual sources
let EXPECTED_LIBRARY_VERSION: string;
let EXPECTED_CRUCIBLE_VERSION: string;

beforeAll(async () => {
  // Read library version from package.json
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgPath = join(__dirname, '..', '..', '..', 'package.json');
  const pkgContent = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(pkgContent) as { version: string };
  EXPECTED_LIBRARY_VERSION = pkg.version;

  // Read Crucible version from metadata
  const metadataPath = join(__dirname, '..', '..', '..', '.crucible', 'metadata', 'metadata.yaml');
  const metadataContent = await readFile(metadataPath, 'utf-8');
  const metadata = parseYAML(metadataContent) as {
    sources?: Array<{ version?: string }>;
  };
  EXPECTED_CRUCIBLE_VERSION = metadata.sources?.[0]?.version || 'unknown';
});

beforeEach(async () => {
  await mkdir(TEST_OUT_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_OUT_DIR, { recursive: true, force: true });
});

describe('exportSchema', () => {
  describe('success paths', () => {
    test('exports schema to JSON with provenance', async () => {
      const outPath = join(TEST_OUT_DIR, 'exit-codes.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        includeProvenance: true,
        validate: true,
      });

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.includeProvenance).toBe(true);
      expect(result.provenance).toBeDefined();
      expect(result.provenance?.schema_id).toBe('library/foundry/v1.0.0/exit-codes');
      expect(result.provenance?.crucible_version).toBe(EXPECTED_CRUCIBLE_VERSION);
      expect(result.provenance?.library_version).toBe(EXPECTED_LIBRARY_VERSION);
      expect(result.provenance?.export_source).toBe('tsfulmen');
      expect(result.provenance?.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Verify file was created
      const content = await readFile(outPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.$comment).toBeDefined();
      expect(parsed.$comment['x-crucible-source']).toBeDefined();
      expect(parsed.$comment['x-crucible-source'].schema_id).toBe(
        'library/foundry/v1.0.0/exit-codes',
      );
      expect(parsed.$comment['x-crucible-source'].crucible_version).toBe(EXPECTED_CRUCIBLE_VERSION);
      expect(parsed.$comment['x-crucible-source'].library_version).toBe(EXPECTED_LIBRARY_VERSION);
    });

    test('exports schema to YAML with provenance', async () => {
      const outPath = join(TEST_OUT_DIR, 'exit-codes.schema.yaml');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        format: 'yaml',
        includeProvenance: true,
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('yaml');

      // Verify provenance comment block
      const content = await readFile(outPath, 'utf-8');
      expect(content).toContain('# x-crucible-source:');
      expect(content).toContain('#   schema_id: library/foundry/v1.0.0/exit-codes');
      expect(content).toContain(`#   crucible_version: ${EXPECTED_CRUCIBLE_VERSION}`);
      expect(content).toContain(`#   library_version: ${EXPECTED_LIBRARY_VERSION}`);
      expect(content).toContain('#   export_source: tsfulmen');
    });

    test('exports schema without provenance', async () => {
      const outPath = join(TEST_OUT_DIR, 'exit-codes-no-prov.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        includeProvenance: false,
      });

      expect(result.includeProvenance).toBe(false);
      expect(result.provenance).toBeUndefined();

      const content = await readFile(outPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Verify no provenance metadata
      expect(parsed.$comment?.['x-crucible-source']).toBeUndefined();
    });

    test('auto-detects JSON format from extension', async () => {
      const outPath = join(TEST_OUT_DIR, 'schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.format).toBe('json');
    });

    test('auto-detects YAML format from .yaml extension', async () => {
      const outPath = join(TEST_OUT_DIR, 'schema.yaml');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        format: 'auto',
      });

      expect(result.format).toBe('yaml');
    });

    test('auto-detects YAML format from .yml extension', async () => {
      const outPath = join(TEST_OUT_DIR, 'schema.yml');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.format).toBe('yaml');
    });
  });

  describe('overwrite handling', () => {
    test('refuses to overwrite existing file', async () => {
      const outPath = join(TEST_OUT_DIR, 'existing.schema.json');

      // Create initial export
      await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      // Attempt to export again without overwrite
      await expect(
        exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
          overwrite: false,
        }),
      ).rejects.toThrow(SchemaExportError);

      await expect(
        exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
          overwrite: false,
        }),
      ).rejects.toThrow(/already exists/i);
    });

    test('overwrites file when force flag set', async () => {
      const outPath = join(TEST_OUT_DIR, 'overwrite.schema.json');

      // Create initial export
      await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      // Overwrite with different schema
      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/patterns',
        outPath,
        overwrite: true,
      });

      expect(result.success).toBe(true);
      expect(result.schemaId).toBe('library/foundry/v1.0.0/patterns');

      // Verify file was actually overwritten
      const content = await readFile(outPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.$comment?.['x-crucible-source']?.schema_id).toBe(
        'library/foundry/v1.0.0/patterns',
      );
    });
  });

  describe('error handling', () => {
    test('throws error for non-existent schema', async () => {
      const outPath = join(TEST_OUT_DIR, 'nonexistent.schema.json');

      await expect(
        exportSchema({
          schemaId: 'does/not/exist',
          outPath,
        }),
      ).rejects.toThrow();
    });

    test('throws error for invalid format extension', async () => {
      const outPath = join(TEST_OUT_DIR, 'schema.txt');

      await expect(
        exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
        }),
      ).rejects.toThrow(SchemaExportError);

      await expect(
        exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
        }),
      ).rejects.toThrow(/invalid.*format/i);
    });

    test('validates schema before export when validate=true', async () => {
      const outPath = join(TEST_OUT_DIR, 'validated.schema.json');

      // This should succeed because the schema is valid
      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        validate: true,
      });

      expect(result.success).toBe(true);
    });

    test('skips validation when validate=false', async () => {
      const outPath = join(TEST_OUT_DIR, 'no-validate.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        validate: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error reasons', () => {
    test('FILE_EXISTS reason when file already exists', async () => {
      const outPath = join(TEST_OUT_DIR, 'exists-reason.json');

      // Create initial export
      await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      // Attempt without overwrite should throw with FILE_EXISTS reason
      try {
        await exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
          overwrite: false,
        });
        expect.fail('Should have thrown SchemaExportError');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaExportError);
        expect((error as SchemaExportError).reason).toBe(ExportErrorReason.FILE_EXISTS);
      }
    });

    test('INVALID_FORMAT reason for invalid extension', async () => {
      const outPath = join(TEST_OUT_DIR, 'invalid.txt');

      try {
        await exportSchema({
          schemaId: 'library/foundry/v1.0.0/exit-codes',
          outPath,
        });
        expect.fail('Should have thrown SchemaExportError');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaExportError);
        expect((error as SchemaExportError).reason).toBe(ExportErrorReason.INVALID_FORMAT);
      }
    });
  });

  describe('directory creation', () => {
    test('creates output directory if missing', async () => {
      const outPath = join(TEST_OUT_DIR, 'nested', 'deep', 'schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.success).toBe(true);

      // Verify file exists at nested path
      const content = await readFile(outPath, 'utf-8');
      expect(content).toBeDefined();
    });

    test('handles multiple nested levels', async () => {
      const outPath = join(TEST_OUT_DIR, 'a', 'b', 'c', 'd', 'e', 'schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.success).toBe(true);
      await expect(access(outPath)).resolves.toBeUndefined();
    });
  });

  describe('provenance metadata', () => {
    test('includes crucible version from metadata', async () => {
      const outPath = join(TEST_OUT_DIR, 'with-version.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.provenance?.crucible_version).toBe(EXPECTED_CRUCIBLE_VERSION);
    });

    test('includes library version from package.json', async () => {
      const outPath = join(TEST_OUT_DIR, 'with-lib-version.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.provenance?.library_version).toBe(EXPECTED_LIBRARY_VERSION);
    });

    test('includes git revision from metadata', async () => {
      const outPath = join(TEST_OUT_DIR, 'with-revision.schema.json');

      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });

      expect(result.provenance?.revision).toBeDefined();
      expect(result.provenance?.revision).toMatch(/^[a-f0-9]{40}$/);
    });

    test('includes export timestamp in ISO format', async () => {
      const outPath = join(TEST_OUT_DIR, 'with-timestamp.schema.json');

      const beforeExport = new Date();
      const result = await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
      });
      const afterExport = new Date();

      expect(result.provenance?.exported_at).toBeDefined();
      const exportedAt = result.provenance?.exported_at;
      if (!exportedAt) {
        throw new Error('Expected provenance export timestamp to be defined');
      }
      const exportTime = new Date(exportedAt);
      expect(exportTime.getTime()).toBeGreaterThanOrEqual(beforeExport.getTime());
      expect(exportTime.getTime()).toBeLessThanOrEqual(afterExport.getTime());
    });
  });
});

describe('stripProvenance', () => {
  describe('JSON format', () => {
    test('strips provenance from JSON', () => {
      const withProvenance = JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $comment: {
            'x-crucible-source': {
              schema_id: 'test/schema',
              crucible_version: '0.2.4',
              library_version: '0.1.4',
            },
            other: 'data',
          },
          type: 'object',
        },
        null,
        2,
      );

      const stripped = stripProvenance(withProvenance);
      const parsed = JSON.parse(stripped);

      expect(parsed.$comment?.['x-crucible-source']).toBeUndefined();
      expect(parsed.$comment?.other).toBe('data');
    });

    test('removes empty $comment after stripping', () => {
      const withProvenance = JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $comment: {
            'x-crucible-source': {
              schema_id: 'test/schema',
            },
          },
          type: 'object',
        },
        null,
        2,
      );

      const stripped = stripProvenance(withProvenance);
      const parsed = JSON.parse(stripped);

      expect(parsed.$comment).toBeUndefined();
    });

    test('preserves other $comment properties', () => {
      const withProvenance = JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $comment: {
            'x-crucible-source': { schema_id: 'test' },
            'x-custom': 'keep this',
            note: 'important note',
          },
          type: 'object',
        },
        null,
        2,
      );

      const stripped = stripProvenance(withProvenance);
      const parsed = JSON.parse(stripped);

      expect(parsed.$comment?.['x-crucible-source']).toBeUndefined();
      expect(parsed.$comment?.['x-custom']).toBe('keep this');
      expect(parsed.$comment?.note).toBe('important note');
    });

    test('handles schema with no $comment', () => {
      const noComment = JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
        },
        null,
        2,
      );

      const stripped = stripProvenance(noComment);
      const parsed = JSON.parse(stripped);

      expect(parsed.$comment).toBeUndefined();
      expect(parsed.type).toBe('object');
    });
  });

  describe('YAML format', () => {
    test('strips provenance from YAML', () => {
      const withProvenance = `# x-crucible-source:
#   schema_id: test/schema
#   crucible_version: 0.2.4
#   library_version: 0.1.4

$schema: https://json-schema.org/draft/2020-12/schema
type: object
`;

      const stripped = stripProvenance(withProvenance);

      expect(stripped).not.toContain('x-crucible-source');
      expect(stripped).not.toContain('crucible_version');
      expect(stripped).not.toContain('library_version');
      expect(stripped).toContain('$schema:');
      expect(stripped).toContain('type: object');
    });

    test('removes leading blank lines after strip', () => {
      const withProvenance = `# x-crucible-source:
#   schema_id: test/schema

$schema: https://json-schema.org/draft/2020-12/schema
`;

      const stripped = stripProvenance(withProvenance);

      expect(stripped).toMatch(/^\$schema:/);
    });

    test('preserves other YAML comments', () => {
      const withProvenance = `# x-crucible-source:
#   schema_id: test/schema

# This is an important comment
# that should be preserved
$schema: https://json-schema.org/draft/2020-12/schema
`;

      const stripped = stripProvenance(withProvenance);

      expect(stripped).not.toContain('x-crucible-source');
      expect(stripped).toContain('This is an important comment');
      expect(stripped).toContain('that should be preserved');
    });
  });

  describe('round-trip with export', () => {
    test('stripped export matches runtime schema semantically', async () => {
      const outPath = join(TEST_OUT_DIR, 'roundtrip.schema.json');

      // Export with provenance
      await exportSchema({
        schemaId: 'library/foundry/v1.0.0/exit-codes',
        outPath,
        includeProvenance: true,
      });

      // Read and strip provenance
      const exported = await readFile(outPath, 'utf-8');
      const stripped = stripProvenance(exported);

      // Verify $comment is gone
      const strippedObj = JSON.parse(stripped);
      expect(strippedObj.$comment).toBeUndefined();

      // Verify schema structure is intact
      expect(strippedObj.$schema).toBeDefined();
      expect(strippedObj.type).toBe('object');
    });
  });
});
