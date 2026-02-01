/**
 * HTTP Control Discovery Endpoint Helper
 *
 * Framework-agnostic scaffold for a control-plane discovery endpoint.
 */

import { buildRuntimeInfo } from "../../appidentity/runtime.js";
import type { Identity } from "../../appidentity/types.js";
import type { AuthHook, AuthResult } from "./http-helper.js";
import type { FallbackLogger, TelemetryEmitter } from "./windows.js";

export interface ControlEndpointDescriptor {
  method: string;
  path: string;
  summary?: string;
}

export interface ControlDiscoveryResponse {
  status: "ok";
  service: {
    name: string;
    vendor: string;
    version: string;
  };
  runtime: {
    name: string;
    version?: string;
    platform: string;
    arch: string;
  };
  auth_summary?: string;
  endpoints: ControlEndpointDescriptor[];
}

export interface ControlDiscoveryErrorResponse {
  status: "error";
  error: string;
  message: string;
}

export interface ControlDiscoveryEndpointOptions {
  identity: Identity;
  version: string;
  endpoints: ControlEndpointDescriptor[];

  auth?: AuthHook;
  authSummary?: string;

  logger?: FallbackLogger;
  telemetry?: TelemetryEmitter;
}

export function createControlDiscoveryEndpoint(options: ControlDiscoveryEndpointOptions): (
  req: unknown,
) => Promise<
  (ControlDiscoveryResponse | ControlDiscoveryErrorResponse) & {
    statusCode?: number;
  }
> {
  const { identity, version, endpoints, auth, authSummary, logger, telemetry } = options;

  return async (req: unknown) => {
    if (auth) {
      const authResult: AuthResult = await auth(req);
      if (!authResult.authenticated) {
        if (logger) {
          logger.warn("Control discovery endpoint: authentication failed", {
            reason: authResult.reason,
          });
        }

        if (telemetry) {
          telemetry.emit("fulmen.control.discovery.auth_failed", {
            service: identity.app.binary_name,
          });
        }

        return {
          status: "error",
          error: "authentication_failed",
          message: authResult.reason || "Authentication required",
          statusCode: 401,
        };
      }
    }

    if (telemetry) {
      telemetry.emit("fulmen.control.discovery.served", {
        service: identity.app.binary_name,
      });
    }

    const runtime = buildRuntimeInfo({ identity, version });

    return {
      status: "ok",
      service: {
        name: identity.app.binary_name,
        vendor: identity.app.vendor,
        version,
      },
      runtime: {
        name: runtime.runtime.name,
        version: runtime.runtime.version,
        platform: runtime.platform.os,
        arch: runtime.platform.arch,
      },
      auth_summary: authSummary,
      endpoints,
      statusCode: 200,
    };
  };
}
