import { describe, expect, test, vi } from "vitest";
import { createControlDiscoveryEndpoint } from "../control-discovery-endpoint.js";

describe("createControlDiscoveryEndpoint", () => {
  test("returns discovery payload", async () => {
    const handler = createControlDiscoveryEndpoint({
      identity: {
        app: {
          binary_name: "tuvan",
          vendor: "fulmenhq",
          env_prefix: "TUVAN_",
          config_name: "tuvan",
          description: "test",
        },
      },
      version: "0.1.0",
      endpoints: [{ method: "POST", path: "/admin/signal" }],
      authSummary: "bearer",
    });

    const result = await handler({});
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.service.name).toBe("tuvan");
      expect(result.service.vendor).toBe("fulmenhq");
      expect(result.service.version).toBe("0.1.0");
      expect(result.endpoints).toHaveLength(1);
    }
  });

  test("rejects unauthenticated when auth hook provided", async () => {
    const auth = vi.fn().mockResolvedValue({ authenticated: false, reason: "nope" });
    const handler = createControlDiscoveryEndpoint({
      identity: {
        app: {
          binary_name: "tuvan",
          vendor: "fulmenhq",
          env_prefix: "TUVAN_",
          config_name: "tuvan",
          description: "test",
        },
      },
      version: "0.1.0",
      endpoints: [],
      auth,
    });

    const result = await handler({});
    expect(result.status).toBe("error");
    expect(result.statusCode).toBe(401);
  });
});
