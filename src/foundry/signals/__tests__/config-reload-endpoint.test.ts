import { describe, expect, test, vi } from "vitest";
import { createConfigReloadEndpoint } from "../config-reload-endpoint.js";

describe("createConfigReloadEndpoint", () => {
  test("rejects unauthenticated requests", async () => {
    const auth = vi.fn().mockResolvedValue({ authenticated: false, reason: "nope" });
    const handler = createConfigReloadEndpoint({
      auth,
      loader: async () => ({ ok: true }),
    });

    const result = await handler({}, {});
    expect(result.status).toBe("error");
    expect(result.statusCode).toBe(401);
  });

  test("returns validation errors when provided validator rejects", async () => {
    const auth = vi.fn().mockResolvedValue({ authenticated: true, identity: "test" });
    const loader = vi.fn().mockResolvedValue({ port: "nope" });
    const validator = vi.fn().mockResolvedValue({
      valid: false,
      errors: [{ path: "server.port", message: "must be integer" }],
    });

    const handler = createConfigReloadEndpoint({ auth, loader, validator });
    const result = await handler({}, {});

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toBe("validation_failed");
      expect(result.statusCode).toBe(422);
    }
  });

  test("invokes onReload and returns reloaded", async () => {
    const auth = vi.fn().mockResolvedValue({ authenticated: true, identity: "test" });
    const loader = vi.fn().mockResolvedValue({ port: 8080 });
    const onReload = vi.fn().mockResolvedValue(undefined);

    const handler = createConfigReloadEndpoint({ auth, loader, onReload });
    const result = await handler({ correlation_id: "c-1" }, {});

    expect(result.status).toBe("reloaded");
    if (result.status === "reloaded") {
      expect(result.correlation_id).toBe("c-1");
      expect(onReload).toHaveBeenCalledWith({ port: 8080 });
    }
  });
});
