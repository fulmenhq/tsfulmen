/**
 * Policy enforcement for progressive logging profiles
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { type LoggingPolicy, LoggingProfile, PolicyError } from './types.js';

/**
 * Options for profile validation
 */
export interface PolicyValidationOptions {
  appType?: string;
  environment?: string;
}

/**
 * Policy enforcer for validating logging profiles against organizational policies
 */
export class PolicyEnforcer {
  private readonly policy: LoggingPolicy;
  private readonly policyFile: string;

  /**
   * Create a new policy enforcer
   *
   * @param policyFile - Path to YAML policy file
   * @throws {PolicyError} If policy file cannot be loaded or is invalid
   */
  constructor(policyFile: string) {
    this.policyFile = policyFile;
    this.policy = this.loadPolicy(policyFile);
  }

  /**
   * Validate if a profile is allowed under the current policy
   *
   * @param profile - The logging profile to validate
   * @param options - Optional validation context (appType, environment)
   * @returns true if profile is allowed, false otherwise
   *
   * @example
   * const enforcer = new PolicyEnforcer('/org/logging-policy.yaml');
   * if (enforcer.validateProfile(LoggingProfile.ENTERPRISE, { environment: 'production' })) {
   *   // Profile is allowed
   * }
   */
  validateProfile(profile: LoggingProfile, options?: PolicyValidationOptions): boolean {
    // Check if profile is in allowed list
    if (!this.policy.allowedProfiles.includes(profile)) {
      return false;
    }

    // Check environment-specific rules if environment provided
    if (options?.environment && this.policy.environmentRules) {
      const envRules = this.policy.environmentRules[options.environment];
      if (envRules && !envRules.includes(profile)) {
        return false;
      }
    }

    // Check app-type specific requirements if appType provided
    if (options?.appType && this.policy.requiredProfiles) {
      const appTypeRules = this.policy.requiredProfiles[options.appType];
      if (appTypeRules && !appTypeRules.includes(profile)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the required profile for a given app type and environment
   *
   * @param appType - The application type
   * @param environment - The deployment environment
   * @returns The required logging profile
   * @throws {PolicyError} If no required profile found for app type
   *
   * @example
   * const enforcer = new PolicyEnforcer('/org/logging-policy.yaml');
   * const profile = enforcer.getRequiredProfile('api-server', 'production');
   * // Returns LoggingProfile.ENTERPRISE
   */
  getRequiredProfile(appType: string, environment: string): LoggingProfile {
    // Check required profiles by app type
    if (this.policy.requiredProfiles?.[appType]) {
      const profiles = this.policy.requiredProfiles[appType];

      // If environment rules exist, filter by environment
      if (this.policy.environmentRules?.[environment]) {
        const envProfiles = this.policy.environmentRules[environment];
        const validProfiles = profiles.filter((p) => envProfiles.includes(p));

        if (validProfiles.length > 0) {
          // Return most restrictive (highest in enum order)
          return this.getMostRestrictiveProfile(validProfiles);
        }
      }

      // Return most restrictive from app type requirements
      return this.getMostRestrictiveProfile(profiles);
    }

    throw new PolicyError(
      `No required profile found for app type "${appType}" in policy ${this.policyFile}`,
    );
  }

  /**
   * Get a helpful error message for policy validation failure
   *
   * @param profile - The profile that failed validation
   * @param options - The validation options used
   * @returns A descriptive error message
   */
  getValidationErrorMessage(profile: LoggingProfile, options?: PolicyValidationOptions): string {
    const parts: string[] = [`Profile "${profile}" not allowed by policy "${this.policyFile}".`];

    if (options?.environment) {
      parts.push(`Environment: ${options.environment}`);
    }

    if (options?.appType) {
      parts.push(`App Type: ${options.appType}`);
    }

    parts.push(`Allowed profiles: ${this.policy.allowedProfiles.join(', ')}`);

    if (options?.environment && this.policy.environmentRules?.[options.environment]) {
      const envProfiles = this.policy.environmentRules[options.environment];
      parts.push(`Environment "${options.environment}" allows: ${envProfiles.join(', ')}`);
    }

    if (options?.appType && this.policy.requiredProfiles?.[options.appType]) {
      const appProfiles = this.policy.requiredProfiles[options.appType];
      parts.push(`App type "${options.appType}" requires: ${appProfiles.join(', ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Load and parse the policy file
   *
   * @param policyFile - Path to YAML policy file
   * @returns Parsed logging policy
   * @throws {PolicyError} If file cannot be read or parsed
   */
  private loadPolicy(policyFile: string): LoggingPolicy {
    try {
      const content = readFileSync(policyFile, 'utf-8');
      const parsed = parseYaml(content) as LoggingPolicy;

      // Validate required fields
      if (!parsed.allowedProfiles || !Array.isArray(parsed.allowedProfiles)) {
        throw new PolicyError(
          `Invalid policy file ${policyFile}: missing or invalid "allowedProfiles" field`,
        );
      }

      // Ensure all profile values are valid
      const validProfiles = Object.values(LoggingProfile);
      for (const profile of parsed.allowedProfiles) {
        if (!validProfiles.includes(profile)) {
          throw new PolicyError(`Invalid policy file ${policyFile}: unknown profile "${profile}"`);
        }
      }

      // Validate requiredProfiles structure if present
      if (parsed.requiredProfiles) {
        if (typeof parsed.requiredProfiles !== 'object') {
          throw new PolicyError(
            `Invalid policy file ${policyFile}: "requiredProfiles" must be an object`,
          );
        }

        for (const [appType, profiles] of Object.entries(parsed.requiredProfiles)) {
          if (!Array.isArray(profiles)) {
            throw new PolicyError(
              `Invalid policy file ${policyFile}: requiredProfiles["${appType}"] must be an array, got ${typeof profiles}. ` +
                'Check YAML formatting - each profile should be on a new line with a hyphen.',
            );
          }

          for (const profile of profiles) {
            if (!validProfiles.includes(profile)) {
              throw new PolicyError(
                `Invalid policy file ${policyFile}: requiredProfiles["${appType}"] contains unknown profile "${profile}"`,
              );
            }
          }
        }
      }

      // Validate environmentRules structure if present
      if (parsed.environmentRules) {
        if (typeof parsed.environmentRules !== 'object') {
          throw new PolicyError(
            `Invalid policy file ${policyFile}: "environmentRules" must be an object`,
          );
        }

        for (const [environment, profiles] of Object.entries(parsed.environmentRules)) {
          if (!Array.isArray(profiles)) {
            throw new PolicyError(
              `Invalid policy file ${policyFile}: environmentRules["${environment}"] must be an array, got ${typeof profiles}. ` +
                'Check YAML formatting - each profile should be on a new line with a hyphen.',
            );
          }

          for (const profile of profiles) {
            if (!validProfiles.includes(profile)) {
              throw new PolicyError(
                `Invalid policy file ${policyFile}: environmentRules["${environment}"] contains unknown profile "${profile}"`,
              );
            }
          }
        }
      }

      return parsed;
    } catch (error) {
      if (error instanceof PolicyError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new PolicyError(`Policy file not found: ${policyFile}`);
      }

      throw new PolicyError(
        `Failed to load policy file ${policyFile}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get the most restrictive profile from a list
   * Order: CUSTOM > ENTERPRISE > STRUCTURED > SIMPLE
   *
   * @param profiles - List of profiles
   * @returns The most restrictive profile
   */
  private getMostRestrictiveProfile(profiles: LoggingProfile[]): LoggingProfile {
    const order = [
      LoggingProfile.CUSTOM,
      LoggingProfile.ENTERPRISE,
      LoggingProfile.STRUCTURED,
      LoggingProfile.SIMPLE,
    ];

    for (const profile of order) {
      if (profiles.includes(profile)) {
        return profile;
      }
    }

    // Fallback to first in list (shouldn't happen with valid input)
    return profiles[0];
  }
}
