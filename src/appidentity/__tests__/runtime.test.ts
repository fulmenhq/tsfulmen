import { describe, expect, it } from "vitest";
import { buildRuntimeInfo } from "../runtime.js";

describe("buildRuntimeInfo", () => {
  it("includes platform info", () => {
    const info = buildRuntimeInfo({ serviceName: "svc", version: "1.2.3" });
    expect(info.service.name).toBe("svc");
    expect(info.service.version).toBe("1.2.3");
    expect(info.platform.os).toBeDefined();
    expect(info.platform.arch).toBeDefined();
  });
});
