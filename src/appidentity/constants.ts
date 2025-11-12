/**
 * Application Identity Constants
 *
 * Centralized configuration for identity discovery and validation
 */

/**
 * Filename for identity document
 */
export const APP_IDENTITY_FILENAME = "app.yaml";

/**
 * Directory containing identity file
 */
export const APP_IDENTITY_DIR = ".fulmen";

/**
 * Environment variable for explicit path override
 */
export const APP_IDENTITY_ENV_VAR = "FULMEN_APP_IDENTITY_PATH";

/**
 * Schema ID for validation
 */
export const APP_IDENTITY_SCHEMA_ID = "config/repository/app-identity/v1.0.0/app-identity";

/**
 * Maximum depth for ancestor directory search
 * Prevents infinite loops and excessive filesystem traversal
 */
export const MAX_ANCESTOR_SEARCH_DEPTH = 20;
