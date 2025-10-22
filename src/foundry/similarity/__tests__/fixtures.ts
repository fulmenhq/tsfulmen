import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateDataBySchemaId } from '../../../schema/index.js';
import { SimilarityError } from '../errors.js';
import type { NormalizeOptions, Suggestion, SuggestOptions } from '../types.js';

export interface DistanceTestCase {
  input_a: string;
  input_b: string;
  expected_distance: number;
  expected_score: number;
  description?: string;
  tags?: string[];
}

export interface NormalizationTestCase {
  input: string;
  options?: NormalizeOptions;
  expected: string;
  description?: string;
  tags?: string[];
}

interface NormalizationYamlCase {
  input: string;
  options?: {
    strip_accents?: boolean;
    locale?: string;
  };
  expected: string;
  description?: string;
  tags?: string[];
}

export interface SuggestionTestCase {
  input: string;
  candidates: string[];
  options?: SuggestOptions;
  expected: Suggestion[];
  description?: string;
  tags?: string[];
}

interface SuggestionYamlCase {
  input: string;
  candidates: string[];
  options?: {
    min_score?: number;
    max_suggestions?: number;
    normalize?: boolean;
  };
  expected: Suggestion[];
  description?: string;
  tags?: string[];
}

export interface TestCaseGroup {
  category: 'distance' | 'normalization' | 'suggestions';
  cases: (DistanceTestCase | NormalizationTestCase | SuggestionTestCase)[];
}

export interface SimilarityFixtures {
  version: string;
  test_cases: TestCaseGroup[];
}

let cachedFixtures: SimilarityFixtures | null = null;

export function loadFixtures(): SimilarityFixtures {
  if (cachedFixtures) {
    return cachedFixtures;
  }

  const fixturesPath = join(
    process.cwd(),
    'config',
    'crucible-ts',
    'library',
    'foundry',
    'similarity-fixtures.yaml',
  );

  try {
    const content = readFileSync(fixturesPath, 'utf-8');
    const data = parseYaml(content);

    cachedFixtures = data as SimilarityFixtures;
    return cachedFixtures;
  } catch (error) {
    throw new SimilarityError(
      `Failed to load similarity fixtures from ${fixturesPath}`,
      error instanceof Error ? error : undefined,
    );
  }
}

export async function validateFixtures(): Promise<boolean> {
  const fixtures = loadFixtures();

  const result = await validateDataBySchemaId(fixtures, 'library/foundry/v1.0.0/similarity');

  if (!result.valid) {
    const errorMessages = result.diagnostics.map((d) => `${d.pointer}: ${d.message}`).join(', ');
    throw new SimilarityError(`Similarity fixtures validation failed: ${errorMessages}`);
  }

  return true;
}

export function getDistanceCases(): DistanceTestCase[] {
  const fixtures = loadFixtures();
  const group = fixtures.test_cases.find((g) => g.category === 'distance');
  return (group?.cases as DistanceTestCase[]) || [];
}

export function getNormalizationCases(): NormalizationTestCase[] {
  const fixtures = loadFixtures();
  const group = fixtures.test_cases.find((g) => g.category === 'normalization');
  const cases = (group?.cases as NormalizationYamlCase[]) || [];

  return cases.map((c) => ({
    ...c,
    options: c.options
      ? {
          stripAccents: c.options.strip_accents,
          locale: c.options.locale,
        }
      : undefined,
  }));
}

export function getSuggestionCases(): SuggestionTestCase[] {
  const fixtures = loadFixtures();
  const group = fixtures.test_cases.find((g) => g.category === 'suggestions');
  const cases = (group?.cases as SuggestionYamlCase[]) || [];

  return cases.map((c) => ({
    ...c,
    options: c.options
      ? {
          minScore: c.options.min_score,
          maxSuggestions: c.options.max_suggestions,
          normalize: c.options.normalize,
        }
      : undefined,
  }));
}
