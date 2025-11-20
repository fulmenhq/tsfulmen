import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse } from "yaml";
import { compileSchema, validateData } from "../schema/index.js";
import { ConfigValidationError } from "./errors.js";
import { getConfigSearchPaths, resolveConfigPath } from "./paths.js";
import type { AppIdentifier } from "./types.js";

/**
 * Options for loading configuration
 */
export interface LoadConfigOptions {
  /**
   * Application identifier for resolving user config paths
   */
  identity: AppIdentifier;

  /**
   * Absolute path to the defaults configuration file
   * This file MUST exist
   */
  defaultsPath: string;

  /**
   * Optional absolute path to a schema file for validation
   */
  schemaPath?: string;

  /**
   * Optional environment variable prefix for overrides
   * Defaults to identity.app.env_prefix if available, otherwise identity.app upper-cased
   */
  envPrefix?: string;

  /**
   * Optional override for the user config filename (excluding extension)
   * Defaults to identity.app.config_name or identity.app
   */
  userConfigName?: string;
}

/**
 * Metadata about the loaded configuration
 */
export interface ConfigMetadata {
  /**
   * Path to the defaults file used
   */
  defaultsPath: string;

  /**
   * Path to the user config file used (null if not found)
   */
  userConfigPath: string | null;

  /**
   * Environment variable prefix used for overrides
   */
  envPrefix: string;

  /**
   * List of active configuration layers ("defaults", "user", "env")
   */
  activeLayers: string[];

  /**
   * Schema validation information
   */
  schema: {
    /**
     * Path to the schema file used (if any)
     */
    path: string | null;
    /**
     * Whether validation was performed
     */
    validated: boolean;
  };
}

/**
 * Result of a configuration load operation
 */
export interface LoadedConfig<T> {
  /**
   * The merged configuration object
   */
  config: T;

  /**
   * Metadata about the loading process
   */
  metadata: ConfigMetadata;
}

/**
 * Deep merge two objects.
 * - Arrays are replaced, not merged.
 * - Objects are merged recursively.
 * - primitives are replaced.
 */
// biome-ignore lint/suspicious/noExplicitAny: Deep merge util handles arbitrary config objects
function deepMerge(target: any, source: any): any {
  if (typeof source !== "object" || source === null) {
    return source;
  }

  if (Array.isArray(source)) {
    return structuredClone(source);
  }

  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    return structuredClone(source);
  }

  const output = { ...target };

  for (const key of Object.keys(source)) {
    if (Object.hasOwn(source, key)) {
      if (key in target) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = structuredClone(source[key]);
      }
    }
  }

  return output;
}

/**
 * Parse a value from an environment variable string
 */
// biome-ignore lint/suspicious/noExplicitAny: Return type depends on parsing result (string, number, bool, object)
function parseEnvValue(value: string): any {
  // Boolean
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  // Number
  if (!Number.isNaN(Number(value)) && value.trim() !== "") {
    return Number(value);
  }

  // JSON (e.g. array or object)
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" || Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore JSON parse errors, treat as string
  }

  return value;
}

/**
 * Parse environment variables into a config object
 */
// biome-ignore lint/suspicious/noExplicitAny: Config object is dynamically constructed
function parseEnvVars(prefix: string): any {
  // biome-ignore lint/suspicious/noExplicitAny: Config object is dynamically constructed
  const config: any = {};
  const prefixWithSeparator = `${prefix}_`;

  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;

    if (key.startsWith(prefixWithSeparator)) {
      const keyWithoutPrefix = key.slice(prefixWithSeparator.length);
      const parts = keyWithoutPrefix.split("_").filter((p) => p.length > 0);

      let current = config;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].toLowerCase();

        // If it's the last part, set the value
        if (i === parts.length - 1) {
          current[part] = parseEnvValue(value);
        } else {
          // Create nested object if it doesn't exist
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }
  }

  return config;
}

/**
 * Parse a configuration file based on its extension
 */
// biome-ignore lint/suspicious/noExplicitAny: Parsed config is untyped
async function parseConfigFile(path: string): Promise<any> {
  const content = await readFile(path, "utf-8");
  const ext = extname(path).toLowerCase();

  if (ext === ".json") {
    return JSON.parse(content);
  }

  if (ext === ".yaml" || ext === ".yml") {
    return parse(content);
  }

  throw new Error(`Unsupported config file extension: ${ext}`);
}

/**
 * Load configuration using the Three-Layer pattern:
 * 1. Defaults (required)
 * 2. User Config (optional, XDG-compliant)
 * 3. Environment Variables (optional, prefix-based)
 */
export async function loadConfig<T>(options: LoadConfigOptions): Promise<LoadedConfig<T>> {
  const { identity, defaultsPath, userConfigName } = options;
  const activeLayers: string[] = ["defaults"];

  // Layer 1: Defaults
  let mergedConfig = await parseConfigFile(defaultsPath);

  // Layer 2: User Config
  const configName = userConfigName || identity.app; // Simple fallback, assuming identity.app is suitable

  // We use resolveConfigPath which expects a filename and search paths.
  // But we support multiple extensions (.yaml, .yml, .json).
  // We iterate through extensions and try to find the file.

  const extensions = [".yaml", ".yml", ".json"];
  let userConfigPath: string | null = null;

  const paths = getConfigSearchPaths(identity);

  for (const ext of extensions) {
    const filename = `${configName}${ext}`;
    const foundPath = await resolveConfigPath(filename, paths);
    if (foundPath) {
      userConfigPath = foundPath;
      break;
    }
  }

  if (userConfigPath) {
    const userConfig = await parseConfigFile(userConfigPath);
    mergedConfig = deepMerge(mergedConfig, userConfig);
    activeLayers.push("user");
  }

  // Phase 2: Env Overrides
  const envPrefix =
    options.envPrefix || (identity.app ? identity.app.toUpperCase().replace(/-/g, "_") : "APP");

  const envConfig = parseEnvVars(envPrefix);
  if (Object.keys(envConfig).length > 0) {
    mergedConfig = deepMerge(mergedConfig, envConfig);
    activeLayers.push("env");
  }

  // Phase 3: Validation
  if (options.schemaPath) {
    try {
      const schemaContent = await readFile(options.schemaPath, "utf-8");
      const validator = await compileSchema(schemaContent);
      const result = validateData(mergedConfig, validator);

      if (!result.valid) {
        throw new ConfigValidationError("Configuration validation failed", result.diagnostics);
      }

      // We modify the metadata object that will be returned
      // (Since we return a new object literal below, we just set the property in the return statement)
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigValidationError(
        `Failed to validate configuration: ${(error as Error).message}`,
        undefined,
        error as Error,
      );
    }
  }

  return {
    config: mergedConfig as T,
    metadata: {
      defaultsPath,
      userConfigPath,
      envPrefix,
      activeLayers,
      schema: {
        path: options.schemaPath || null,
        validated: !!options.schemaPath,
      },
    },
  };
}
