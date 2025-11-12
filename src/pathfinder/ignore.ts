import { promises as fs } from "node:fs";
import path from "node:path";

import picomatch from "picomatch";

import { DEFAULT_IGNORE_FILES } from "./constants.js";
import { toPosixPath } from "./safety.js";

interface CompiledRule {
  raw: string;
  negate: boolean;
  directory: boolean;
  pattern: string;
  matcher: picomatch.Matcher;
}

/**
 * `.fulmenignore` support with directory-level caching.
 *
 * Inspired by gitignore semantics: the last matching rule wins and patterns
 * prefixed with `!` re-include paths. Patterns ending with a slash apply to a
 * directory and all descendants.
 */
export class IgnoreMatcher {
  private readonly root: string;
  private readonly ignoreFileNames: string[];
  private readonly ruleCache = new Map<string, CompiledRule[]>();
  private readonly aggregateCache = new Map<string, CompiledRule[]>();

  constructor(root: string, ignoreFileNames: string[] = DEFAULT_IGNORE_FILES) {
    this.root = path.resolve(root);
    this.ignoreFileNames = ignoreFileNames;
  }

  /**
   * Determine whether the relative path should be ignored.
   *
   * @param absolutePath - Absolute filesystem path
   * @param relativePath - Path relative to the finder root (POSIX)
   */
  async shouldIgnore(absolutePath: string, relativePath: string): Promise<boolean> {
    const directory = path.dirname(path.resolve(absolutePath));
    const rules = await this.loadAggregateRules(directory);

    if (rules.length === 0) {
      return false;
    }

    const posixPath = toPosixPath(relativePath);
    let ignored = false;

    for (const rule of rules) {
      if (!this.matchesRule(rule, posixPath)) {
        continue;
      }

      ignored = !rule.negate;
    }

    return ignored;
  }

  private matchesRule(rule: CompiledRule, posixPath: string): boolean {
    if (rule.directory) {
      return posixPath === rule.pattern || posixPath.startsWith(`${rule.pattern}/`);
    }

    if (rule.matcher(posixPath)) {
      return true;
    }

    if (!rule.pattern.includes("/")) {
      const basename = posixPath.split("/").pop() ?? posixPath;
      return rule.matcher(basename);
    }

    return false;
  }

  private async loadAggregateRules(directory: string): Promise<CompiledRule[]> {
    const normalizedDirectory = this.normalizeDirectory(directory);

    const cachedAggregate = this.aggregateCache.get(normalizedDirectory);
    if (cachedAggregate) {
      return cachedAggregate;
    }

    if (!this.isWithinRoot(normalizedDirectory)) {
      this.aggregateCache.set(normalizedDirectory, []);
      return [];
    }

    const parentDirectory = path.dirname(normalizedDirectory);
    const parentRules =
      normalizedDirectory === this.root ? [] : await this.loadAggregateRules(parentDirectory);
    const localRules = await this.loadRulesForDirectory(normalizedDirectory);

    const combined = parentRules.length > 0 ? [...parentRules, ...localRules] : localRules;

    this.aggregateCache.set(normalizedDirectory, combined);
    return combined;
  }

  private async loadRulesForDirectory(directory: string): Promise<CompiledRule[]> {
    const cachedRules = this.ruleCache.get(directory);
    if (cachedRules) {
      return cachedRules;
    }

    const rules: CompiledRule[] = [];
    const relativePrefix = toRelativePrefix(directory, this.root);

    for (const fileName of this.ignoreFileNames) {
      const filePath = path.join(directory, fileName);

      let content: string | undefined;
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }

      const fileRules = this.parseRules(content, relativePrefix);
      rules.push(...fileRules);
    }

    this.ruleCache.set(directory, rules);
    return rules;
  }

  private parseRules(content: string, relativePrefix: string): CompiledRule[] {
    const compiled: CompiledRule[] = [];

    for (const rawLine of content.split(/\r?\n/)) {
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      let negate = false;
      let pattern = trimmed;

      if (pattern.startsWith("!")) {
        negate = true;
        pattern = pattern.slice(1).trim();
        if (!pattern) continue;
      }

      let directory = false;
      if (pattern.endsWith("/")) {
        directory = true;
        pattern = pattern.slice(0, -1);
      }

      const normalizedPatternFromFile = pattern.replace(/\\/g, "/");
      const resolvedPattern = resolvePattern(normalizedPatternFromFile, relativePrefix);

      const normalizedPattern = resolvedPattern.pattern;
      directory = directory || resolvedPattern.directory;
      const matcher = picomatch(normalizedPattern, {
        dot: true,
        posixSlashes: true,
        matchBase: !normalizedPattern.includes("/"),
      });

      compiled.push({
        raw: rawLine,
        negate,
        directory,
        pattern: normalizedPattern,
        matcher,
      });
    }

    return compiled;
  }

  private normalizeDirectory(directory: string): string {
    return path.resolve(directory);
  }

  private isWithinRoot(directory: string): boolean {
    return isSubPath(directory, this.root);
  }
}

function isSubPath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toRelativePrefix(directory: string, root: string): string {
  const relative = path.relative(root, directory);
  if (!relative || relative === ".") {
    return "";
  }

  return toPosixPath(relative);
}

function resolvePattern(
  pattern: string,
  relativePrefix: string,
): {
  pattern: string;
  directory: boolean;
} {
  let directory = false;
  let normalized = pattern;

  if (pattern.startsWith("/")) {
    normalized = pattern.slice(1);
  } else if (relativePrefix) {
    normalized = `${relativePrefix}/${pattern}`;
  }

  if (normalized.endsWith("/")) {
    directory = true;
    normalized = normalized.slice(0, -1);
  }

  return {
    pattern: normalized.replace(/\\/g, "/"),
    directory,
  };
}
