/**
 * HTTP Middleware Type Definitions
 *
 * Generic type interfaces for HTTP framework integration.
 * Supports Express, Fastify, Bun, and Node.js HTTP servers.
 */

/**
 * Generic HTTP request interface
 * Captures common properties across Express, Fastify, and Bun
 */
export interface GenericHttpRequest {
  method?: string;
  path?: string;
  url?: string;
  route?: {
    path?: string;
  };
  routeOptions?: {
    url?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Generic HTTP response interface
 * Captures common properties across frameworks
 */
export interface GenericHttpResponse {
  statusCode?: number;
  getHeader?: (name: string) => string | number | string[] | undefined;
}

/**
 * Express-style middleware next function
 */
export type NextFunction = (err?: Error) => void;

/**
 * Route normalizer callback
 * Extracts normalized route template from framework request
 */
export type RouteNormalizer = (req: GenericHttpRequest) => string;

/**
 * Method extractor callback
 * Extracts HTTP method from framework request
 */
export type MethodExtractor = (req: GenericHttpRequest) => string;

/**
 * Status extractor callback
 * Extracts HTTP status code from framework response
 */
export type StatusExtractor = (res: GenericHttpResponse) => number;
