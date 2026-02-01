/**
 * Environment variable alias utilities.
 *
 * Workhorse templates sometimes support both canonical nested env vars and
 * convenience aliases (e.g. TUVAN_SERVER_PORT vs TUVAN_PORT).
 *
 * This helper standardizes alias resolution and conflict reporting.
 */

export interface EnvAliasConflict {
  canonicalKey: string;
  aliasKey: string;
  canonicalValue: string;
  aliasValue: string;
}

export interface ResolveEnvAliasesResult {
  env: Record<string, string | undefined>;
  applied: Array<{ aliasKey: string; canonicalKey: string }>;
  conflicts: EnvAliasConflict[];
}

/**
 * Resolve env var aliases into canonical keys.
 *
 * - If canonical key is unset and alias is set, the alias value is copied to canonical.
 * - If both are set and differ, a conflict is recorded (canonical is left unchanged).
 */
export function resolveEnvAliases(
  env: Record<string, string | undefined>,
  aliasToCanonical: Record<string, string>,
): ResolveEnvAliasesResult {
  const out: Record<string, string | undefined> = { ...env };
  const applied: Array<{ aliasKey: string; canonicalKey: string }> = [];
  const conflicts: EnvAliasConflict[] = [];

  for (const [aliasKey, canonicalKey] of Object.entries(aliasToCanonical)) {
    const aliasValue = env[aliasKey];
    if (aliasValue === undefined || aliasValue === "") continue;

    const canonicalValue = env[canonicalKey];
    if (canonicalValue === undefined || canonicalValue === "") {
      out[canonicalKey] = aliasValue;
      applied.push({ aliasKey, canonicalKey });
      continue;
    }

    if (canonicalValue !== aliasValue) {
      conflicts.push({
        canonicalKey,
        aliasKey,
        canonicalValue,
        aliasValue,
      });
    }
  }

  return { env: out, applied, conflicts };
}
