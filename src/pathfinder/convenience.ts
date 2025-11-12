import { Pathfinder } from "./finder.js";
import type { PathfinderConfig, PathfinderQuery, PathResult } from "./types.js";

const DEFAULT_CONFIG_EXTENSIONS = [".yaml", ".yml", ".json"];
const DEFAULT_SCHEMA_PATTERNS = ["**/*.schema.json", "**/*.schema.yaml"];

function normalizeExtension(extension: string): string {
  return extension.startsWith(".") ? extension : `.${extension}`;
}

function buildIncludePatternsFromExtensions(extensions: string[]): string[] {
  return extensions.map((extension) => `**/*${normalizeExtension(extension)}`);
}

function createFinder(additionalConfig?: Partial<PathfinderConfig>): Pathfinder {
  return new Pathfinder(additionalConfig);
}

async function executeFinder(finder: Pathfinder, query: PathfinderQuery): Promise<PathResult[]> {
  return finder.find(query);
}

export async function findConfigFiles(
  root: string,
  extensions: string[] = DEFAULT_CONFIG_EXTENSIONS,
  additionalConfig?: Partial<PathfinderConfig>,
): Promise<PathResult[]> {
  const include = buildIncludePatternsFromExtensions(extensions);
  const finder = createFinder(additionalConfig);

  return executeFinder(finder, {
    root,
    include,
  });
}

export async function findSchemaFiles(
  root: string,
  additionalConfig?: Partial<PathfinderConfig>,
): Promise<PathResult[]> {
  const finder = createFinder(additionalConfig);
  return executeFinder(finder, {
    root,
    include: DEFAULT_SCHEMA_PATTERNS,
  });
}

export async function findByExtensions(
  root: string,
  extensions: string[],
  additionalConfig?: Partial<PathfinderConfig>,
): Promise<PathResult[]> {
  if (extensions.length === 0) {
    return [];
  }

  const include = buildIncludePatternsFromExtensions(extensions);
  const finder = createFinder(additionalConfig);

  return executeFinder(finder, {
    root,
    include,
  });
}
