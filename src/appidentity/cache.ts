/**
 * Application Identity Cache
 *
 * Process-level caching for identity objects with immutability guarantees
 */

import type { Identity } from "./types.js";

/**
 * Process-level cache storage
 * null = not cached, Identity = cached value
 */
let cachedIdentity: Identity | null = null;

/**
 * Get cached identity if available
 *
 * @returns Cached identity or null if not cached
 */
export function getCachedIdentity(): Identity | null {
  return cachedIdentity;
}

/**
 * Set cached identity
 *
 * Identity object should already be frozen before caching
 *
 * @param identity - Identity to cache (must be frozen)
 */
export function setCachedIdentity(identity: Identity): void {
  cachedIdentity = identity;
}

/**
 * Clear the identity cache
 *
 * Useful for testing or when identity needs to be reloaded
 */
export function clearIdentityCache(): void {
  cachedIdentity = null;
}
