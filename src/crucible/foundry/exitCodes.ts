/**
 * Exit Codes - Generated from Crucible catalog
 *
 * This file is AUTO-GENERATED from the Foundry exit codes catalog.
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 *
 * Catalog Version: v1.0.0
 * Last Reviewed: 2025-10-31
 * Source: config/library/foundry/exit-codes.yaml
 */

/**
 * Standardized process exit codes for Fulmen ecosystem
 *
 * @see https://github.com/fulmenhq/crucible/blob/main/docs/standards/library/foundry/README.md#exit-codes
 */
export const exitCodes = {
  // Standard Exit Codes (0-1)
  // POSIX standard success and generic failure codes
  EXIT_SUCCESS: 0,
  EXIT_FAILURE: 1,

  // Networking & Port Management (10-19)
  // Network-related failures (ports, connectivity, etc.)
  EXIT_PORT_IN_USE: 10,
  EXIT_PORT_RANGE_EXHAUSTED: 11,
  EXIT_INSTANCE_ALREADY_RUNNING: 12,
  EXIT_NETWORK_UNREACHABLE: 13,
  EXIT_CONNECTION_REFUSED: 14,
  EXIT_CONNECTION_TIMEOUT: 15,

  // Configuration & Validation (20-29)
  // Configuration errors, validation failures, version mismatches
  EXIT_CONFIG_INVALID: 20,
  EXIT_MISSING_DEPENDENCY: 21,
  EXIT_SSOT_VERSION_MISMATCH: 22,
  EXIT_CONFIG_FILE_NOT_FOUND: 23,
  EXIT_ENVIRONMENT_INVALID: 24,

  // Runtime Errors (30-39)
  // Errors during normal operation (health checks, database, etc.)
  EXIT_HEALTH_CHECK_FAILED: 30,
  EXIT_DATABASE_UNAVAILABLE: 31,
  EXIT_EXTERNAL_SERVICE_UNAVAILABLE: 32,
  EXIT_RESOURCE_EXHAUSTED: 33,
  EXIT_OPERATION_TIMEOUT: 34,

  // Command-Line Usage Errors (40-49)
  // Invalid arguments, missing required flags, usage errors
  EXIT_INVALID_ARGUMENT: 40,
  EXIT_MISSING_REQUIRED_ARGUMENT: 41,
  EXIT_USAGE: 64,

  // Permissions & File Access (50-59)
  // Permission denied, file not found, access errors
  EXIT_PERMISSION_DENIED: 50,
  EXIT_FILE_NOT_FOUND: 51,
  EXIT_DIRECTORY_NOT_FOUND: 52,
  EXIT_FILE_READ_ERROR: 53,
  EXIT_FILE_WRITE_ERROR: 54,

  // Data & Processing Errors (60-69)
  // Data validation, parsing, transformation failures
  EXIT_DATA_INVALID: 60,
  EXIT_PARSE_ERROR: 61,
  EXIT_TRANSFORMATION_FAILED: 62,
  EXIT_DATA_CORRUPT: 63,

  // Security & Authentication (70-79)
  // Authentication failures, authorization errors, security violations
  EXIT_AUTHENTICATION_FAILED: 70,
  EXIT_AUTHORIZATION_FAILED: 71,
  EXIT_SECURITY_VIOLATION: 72,
  EXIT_CERTIFICATE_INVALID: 73,

  // Observability & Monitoring (80-89)
  // Observability infrastructure failures. Use when observability is CRITICAL to operation (e.g., monitoring agents, telemetry exporters). For workhorses where observability is auxiliary: - Log warning and continue (don't exit) - Emit degraded health status - Only exit if explicitly configured (fail_on_observability_error: true)
  EXIT_METRICS_UNAVAILABLE: 80,
  EXIT_TRACING_FAILED: 81,
  EXIT_LOGGING_FAILED: 82,
  EXIT_ALERT_SYSTEM_FAILED: 83,
  EXIT_STRUCTURED_LOGGING_FAILED: 84,

  // Testing & Validation (91-99)
  // Test execution outcomes and validation failures. NOTE: Test harnesses MUST use EXIT_SUCCESS (0) for successful test runs per ecosystem conventions (pytest, Go testing, Jest all use 0 for success). Codes in this category are for FAILURES and exceptional conditions only.
  EXIT_TEST_FAILURE: 91,
  EXIT_TEST_ERROR: 92,
  EXIT_TEST_INTERRUPTED: 93,
  EXIT_TEST_USAGE_ERROR: 94,
  EXIT_TEST_NO_TESTS_COLLECTED: 95,
  EXIT_COVERAGE_THRESHOLD_NOT_MET: 96,

  // Signal-Induced Exits (128-165)
  // Process terminated by Unix signals (128+N pattern)
  EXIT_SIGNAL_HUP: 129,
  EXIT_SIGNAL_INT: 130,
  EXIT_SIGNAL_QUIT: 131,
  EXIT_SIGNAL_KILL: 137,
  EXIT_SIGNAL_PIPE: 141,
  EXIT_SIGNAL_ALRM: 142,
  EXIT_SIGNAL_TERM: 143,
  EXIT_SIGNAL_USR1: 159,
  EXIT_SIGNAL_USR2: 160,
} as const;

/**
 * Exit code value type - union of all valid exit code numbers
 */
export type ExitCode = (typeof exitCodes)[keyof typeof exitCodes];

/**
 * Exit code name type - union of all valid exit code constant names
 */
export type ExitCodeName = keyof typeof exitCodes;

/**
 * Exit code metadata information
 */
export interface ExitCodeInfo {
  code: number;
  name: string;
  description: string;
  context: string;
  category: string;
  retryHint?: "retry" | "no_retry" | "investigate";
  bsdEquivalent?: string;
  pythonNote?: string;
}

/**
 * Metadata for all exit codes
 */
export const exitCodeMetadata: Record<number, ExitCodeInfo> = {
  0: {
    code: 0,
    name: "EXIT_SUCCESS",
    description: "Successful execution",
    context: "Command completed without errors",
    category: "standard",
  },
  1: {
    code: 1,
    name: "EXIT_FAILURE",
    description: "Generic failure (unspecified error)",
    context: "Use when no more specific exit code applies",
    category: "standard",
  },
  10: {
    code: 10,
    name: "EXIT_PORT_IN_USE",
    description: "Specified port is already in use",
    context: "Server startup when port unavailable and fail_if_unavailable strategy",
    category: "networking",
  },
  11: {
    code: 11,
    name: "EXIT_PORT_RANGE_EXHAUSTED",
    description: "No available ports in configured range",
    context: "Server startup when all ports in environment range occupied",
    category: "networking",
  },
  12: {
    code: 12,
    name: "EXIT_INSTANCE_ALREADY_RUNNING",
    description: "Another instance already running on target port",
    context: "Server startup when PID registry shows active process on port",
    category: "networking",
  },
  13: {
    code: 13,
    name: "EXIT_NETWORK_UNREACHABLE",
    description: "Network destination unreachable",
    context: "Client connections, health checks, external service validation",
    category: "networking",
  },
  14: {
    code: 14,
    name: "EXIT_CONNECTION_REFUSED",
    description: "Connection refused by remote host",
    context: "Database connections, API endpoints, upstream services",
    category: "networking",
  },
  15: {
    code: 15,
    name: "EXIT_CONNECTION_TIMEOUT",
    description: "Connection attempt timed out",
    context: "Slow networks, unresponsive services, firewall blocks",
    category: "networking",
  },
  20: {
    code: 20,
    name: "EXIT_CONFIG_INVALID",
    description: "Configuration file failed validation",
    context: "Startup validation, schema mismatches, invalid YAML/JSON",
    category: "configuration",
    retryHint: "no_retry",
  },
  21: {
    code: 21,
    name: "EXIT_MISSING_DEPENDENCY",
    description: "Required dependency not found",
    context: "Missing binaries, libraries, or runtime requirements",
    category: "configuration",
    retryHint: "investigate",
  },
  22: {
    code: 22,
    name: "EXIT_SSOT_VERSION_MISMATCH",
    description: "SSOT (Crucible) version incompatible",
    context: "Helper library detects unsupported Crucible version",
    category: "configuration",
    retryHint: "no_retry",
  },
  23: {
    code: 23,
    name: "EXIT_CONFIG_FILE_NOT_FOUND",
    description: "Required configuration file not found",
    context: "Explicitly specified config path doesn't exist",
    category: "configuration",
  },
  24: {
    code: 24,
    name: "EXIT_ENVIRONMENT_INVALID",
    description: "Invalid or unsupported environment specification",
    context: "Unknown environment name, missing environment config",
    category: "configuration",
  },
  30: {
    code: 30,
    name: "EXIT_HEALTH_CHECK_FAILED",
    description: "Health check endpoint returned non-healthy status",
    context: "Startup health validation, readiness probes",
    category: "runtime",
    retryHint: "retry",
  },
  31: {
    code: 31,
    name: "EXIT_DATABASE_UNAVAILABLE",
    description: "Database connection failed or unavailable",
    context: "Startup connection checks, critical query failures",
    category: "runtime",
    retryHint: "retry",
  },
  32: {
    code: 32,
    name: "EXIT_EXTERNAL_SERVICE_UNAVAILABLE",
    description: "Required external service unavailable",
    context: "API dependencies, message queues, cache servers",
    category: "runtime",
  },
  33: {
    code: 33,
    name: "EXIT_RESOURCE_EXHAUSTED",
    description: "System resources exhausted (memory, disk, file descriptors)",
    context: "Out-of-memory, disk full, too many open files",
    category: "runtime",
    retryHint: "investigate",
  },
  34: {
    code: 34,
    name: "EXIT_OPERATION_TIMEOUT",
    description: "Operation exceeded timeout threshold",
    context: "Long-running tasks, async operations, batch processing",
    category: "runtime",
    retryHint: "retry",
  },
  40: {
    code: 40,
    name: "EXIT_INVALID_ARGUMENT",
    description: "Invalid command-line argument or flag value",
    context: "Type errors, out-of-range values, malformed input",
    category: "usage",
  },
  41: {
    code: 41,
    name: "EXIT_MISSING_REQUIRED_ARGUMENT",
    description: "Required command-line argument not provided",
    context: "Missing --config, --port, or other required flags",
    category: "usage",
  },
  64: {
    code: 64,
    name: "EXIT_USAGE",
    description: "Command-line usage error",
    context: "BSD sysexits.h EX_USAGE - wrong number of arguments, bad syntax",
    category: "usage",
    bsdEquivalent: "EX_USAGE",
  },
  50: {
    code: 50,
    name: "EXIT_PERMISSION_DENIED",
    description: "Insufficient permissions for operation",
    context: "File access, port binding (<1024), privileged operations",
    category: "permissions",
  },
  51: {
    code: 51,
    name: "EXIT_FILE_NOT_FOUND",
    description: "Required file not found",
    context: "Assets, templates, data files (not config - use 23)",
    category: "permissions",
  },
  52: {
    code: 52,
    name: "EXIT_DIRECTORY_NOT_FOUND",
    description: "Required directory not found",
    context: "State directories, log paths, data directories",
    category: "permissions",
  },
  53: {
    code: 53,
    name: "EXIT_FILE_READ_ERROR",
    description: "Error reading file",
    context: "Corrupt files, I/O errors, encoding issues",
    category: "permissions",
  },
  54: {
    code: 54,
    name: "EXIT_FILE_WRITE_ERROR",
    description: "Error writing file",
    context: "Disk full, read-only filesystem, permission errors",
    category: "permissions",
  },
  60: {
    code: 60,
    name: "EXIT_DATA_INVALID",
    description: "Input data failed validation",
    context: "Schema validation, business rule violations",
    category: "data",
  },
  61: {
    code: 61,
    name: "EXIT_PARSE_ERROR",
    description: "Error parsing input data",
    context: "Malformed JSON/YAML/XML, syntax errors",
    category: "data",
  },
  62: {
    code: 62,
    name: "EXIT_TRANSFORMATION_FAILED",
    description: "Data transformation or conversion failed",
    context: "Type conversions, format transformations, encoding changes",
    category: "data",
  },
  63: {
    code: 63,
    name: "EXIT_DATA_CORRUPT",
    description: "Data corruption detected",
    context: "Checksum failures, integrity violations",
    category: "data",
  },
  70: {
    code: 70,
    name: "EXIT_AUTHENTICATION_FAILED",
    description: "Authentication failed",
    context: "Invalid credentials, expired tokens, auth service unavailable",
    category: "security",
  },
  71: {
    code: 71,
    name: "EXIT_AUTHORIZATION_FAILED",
    description: "Authorization failed (authenticated but insufficient permissions)",
    context: "RBAC failures, scope violations, resource access denied",
    category: "security",
  },
  72: {
    code: 72,
    name: "EXIT_SECURITY_VIOLATION",
    description: "Security policy violation detected",
    context: "Suspicious activity, rate limit exceeded, IP blocklist",
    category: "security",
  },
  73: {
    code: 73,
    name: "EXIT_CERTIFICATE_INVALID",
    description: "TLS/SSL certificate validation failed",
    context: "Expired certs, untrusted CAs, hostname mismatches",
    category: "security",
    bsdEquivalent: "EX_PROTOCOL",
  },
  80: {
    code: 80,
    name: "EXIT_METRICS_UNAVAILABLE",
    description: "Metrics endpoint or collection system unavailable",
    context: "Use for observability-focused tools (Prometheus exporters, StatsD agents).\nWorkhorses SHOULD log warning and continue unless configured to fail-fast.\n",
    category: "observability",
  },
  81: {
    code: 81,
    name: "EXIT_TRACING_FAILED",
    description: "Distributed tracing system unavailable",
    context: "OTLP exporter failed, Jaeger collector unreachable",
    category: "observability",
  },
  82: {
    code: 82,
    name: "EXIT_LOGGING_FAILED",
    description: "Logging system unavailable or misconfigured",
    context: "Log aggregator unreachable, log file unwritable",
    category: "observability",
  },
  83: {
    code: 83,
    name: "EXIT_ALERT_SYSTEM_FAILED",
    description: "Alerting system unavailable",
    context: "PagerDuty API failed, Slack webhook unreachable",
    category: "observability",
  },
  84: {
    code: 84,
    name: "EXIT_STRUCTURED_LOGGING_FAILED",
    description: "Structured logging system unavailable",
    context: "JSON log aggregator unreachable, log schema validation failed",
    category: "observability",
  },
  91: {
    code: 91,
    name: "EXIT_TEST_FAILURE",
    description: "One or more tests failed",
    context: "Test assertions failed, expected behavior not met.\nMaps to pytest exit code 1, Go test failure, Jest failure.\n",
    category: "testing",
  },
  92: {
    code: 92,
    name: "EXIT_TEST_ERROR",
    description: "Test execution error (not test failure)",
    context: "Test setup failed, fixture unavailable, test harness error.\nMaps to pytest exit code 3 (internal error).\n",
    category: "testing",
  },
  93: {
    code: 93,
    name: "EXIT_TEST_INTERRUPTED",
    description: "Test run interrupted by user or system",
    context: "Ctrl+C during tests, system signal, user cancellation.\nMaps to pytest exit code 2.\n",
    category: "testing",
  },
  94: {
    code: 94,
    name: "EXIT_TEST_USAGE_ERROR",
    description: "Test command usage error",
    context: "Invalid test arguments, bad configuration.\nMaps to pytest exit code 4.\n",
    category: "testing",
  },
  95: {
    code: 95,
    name: "EXIT_TEST_NO_TESTS_COLLECTED",
    description: "No tests found or all tests skipped",
    context: "Empty test suite, all tests deselected or skipped.\nMaps to pytest exit code 5.\n",
    category: "testing",
  },
  96: {
    code: 96,
    name: "EXIT_COVERAGE_THRESHOLD_NOT_MET",
    description: "Test coverage below required threshold",
    context: "Code coverage validation, quality gate failure",
    category: "testing",
  },
  129: {
    code: 129,
    name: "EXIT_SIGNAL_HUP",
    description: "Hangup signal (SIGHUP)",
    context: "Terminal disconnected, config reload requested",
    category: "signals",
    bsdEquivalent: "128 + 1",
  },
  130: {
    code: 130,
    name: "EXIT_SIGNAL_INT",
    description: "Interrupt signal (SIGINT)",
    context: "Ctrl+C pressed, user interrupt",
    category: "signals",
    bsdEquivalent: "128 + 2",
  },
  131: {
    code: 131,
    name: "EXIT_SIGNAL_QUIT",
    description: "Quit signal (SIGQUIT)",
    context: "Ctrl+\\ pressed, core dump requested",
    category: "signals",
    bsdEquivalent: "128 + 3",
  },
  137: {
    code: 137,
    name: "EXIT_SIGNAL_KILL",
    description: "Kill signal (SIGKILL)",
    context: "Forceful termination, non-graceful shutdown (not catchable)",
    category: "signals",
    bsdEquivalent: "128 + 9",
    pythonNote: "Cannot be caught in Python (OS-level)",
  },
  141: {
    code: 141,
    name: "EXIT_SIGNAL_PIPE",
    description: "Broken pipe (SIGPIPE)",
    context: "Writing to closed pipe/socket, reader terminated",
    category: "signals",
    bsdEquivalent: "128 + 13",
    pythonNote: "Raised as BrokenPipeError exception",
  },
  142: {
    code: 142,
    name: "EXIT_SIGNAL_ALRM",
    description: "Alarm signal (SIGALRM)",
    context: "Timer expiration, alarm clock",
    category: "signals",
    bsdEquivalent: "128 + 14",
    pythonNote: "Supported by signal module, rarely used in practice",
  },
  143: {
    code: 143,
    name: "EXIT_SIGNAL_TERM",
    description: "Termination signal (SIGTERM)",
    context: "Graceful shutdown requested, normal termination",
    category: "signals",
    bsdEquivalent: "128 + 15",
    pythonNote: "Default signal for graceful shutdown",
  },
  159: {
    code: 159,
    name: "EXIT_SIGNAL_USR1",
    description: "User-defined signal 1 (SIGUSR1)",
    context: "Application-specific signal handling (e.g., reopen logs, dump stats)",
    category: "signals",
    bsdEquivalent: "128 + 31",
  },
  160: {
    code: 160,
    name: "EXIT_SIGNAL_USR2",
    description: "User-defined signal 2 (SIGUSR2)",
    context: "Application-specific signal handling (e.g., toggle debug mode)",
    category: "signals",
    bsdEquivalent: "128 + 32",
  },
};

/**
 * Get metadata for a specific exit code
 *
 * @param code - Exit code number
 * @returns Exit code metadata or undefined if not found
 */
export function getExitCodeInfo(code: number): ExitCodeInfo | undefined {
  return exitCodeMetadata[code];
}

/**
 * Catalog version for telemetry and compatibility checks
 */
export const EXIT_CODES_VERSION = "v1.0.0";
