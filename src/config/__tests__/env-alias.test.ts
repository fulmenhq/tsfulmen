import { describe, expect, it } from "vitest";
import { resolveEnvAliases } from "../env-alias.js";

describe("resolveEnvAliases", () => {
  it("copies alias to canonical when canonical is unset", () => {
    const result = resolveEnvAliases({ TUVAN_PORT: "8080" }, { TUVAN_PORT: "TUVAN_SERVER_PORT" });

    expect(result.env.TUVAN_SERVER_PORT).toBe("8080");
    expect(result.applied).toEqual([{ aliasKey: "TUVAN_PORT", canonicalKey: "TUVAN_SERVER_PORT" }]);
    expect(result.conflicts).toHaveLength(0);
  });

  it("records conflicts when canonical and alias differ", () => {
    const result = resolveEnvAliases(
      { TUVAN_PORT: "8080", TUVAN_SERVER_PORT: "9090" },
      { TUVAN_PORT: "TUVAN_SERVER_PORT" },
    );

    expect(result.env.TUVAN_SERVER_PORT).toBe("9090");
    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toEqual([
      {
        canonicalKey: "TUVAN_SERVER_PORT",
        aliasKey: "TUVAN_PORT",
        canonicalValue: "9090",
        aliasValue: "8080",
      },
    ]);
  });
});
