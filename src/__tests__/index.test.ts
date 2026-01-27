import { describe, expect, it } from "vitest";
import { VERSION } from "../index.js";

describe("tsfulmen", () => {
  it("exports VERSION constant", () => {
    expect(VERSION).toBe("0.2.1");
  });

  it("VERSION is a string", () => {
    expect(typeof VERSION).toBe("string");
  });
});
