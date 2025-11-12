/**
 * Windows-specific path validation tests
 *
 * These tests validate Windows-specific path behaviors including:
 * - Case-insensitive path comparison (C:\Users vs c:\users)
 * - Drive letter normalization (C: vs c:)
 * - Windows absolute path validation
 *
 * These tests are skipped on non-Windows platforms because:
 * - Node.js path resolution behaves differently on Unix vs Windows
 * - Windows drive letters (C:\, D:\) are not valid absolute paths on Unix
 * - Case sensitivity rules differ between platforms
 *
 * The actual validation logic works correctly on Windows - these tests just verify
 * the platform-specific behavior that can't be properly mocked cross-platform.
 */

import { platform } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFulmenConfigDir } from "../paths.js";

describe("Windows Path Validation (Windows-only)", () => {
  // Skip these tests on non-Windows platforms
  const isWindows = platform() === "win32";

  if (!isWindows) {
    it.skip("Windows path validation tests are skipped on non-Windows platforms", () => {
      console.log("Windows path validation tests skipped - running on", platform());
    });
    return;
  }

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should accept case-insensitive paths (C:\\Users vs c:\\users)", () => {
    // Mock Windows environment
    process.env.APPDATA = "C:/Users/TestUser/AppData/Roaming";
    process.env.LOCALAPPDATA = "C:/Users/TestUser/AppData/Local";

    // Test lowercase drive letter
    process.env.FULMEN_CONFIG_HOME = "c:/users/testuser/appdata/roaming/fulmen/config";

    expect(() => getFulmenConfigDir({ customHomeDir: "C:/Users/TestUser" })).not.toThrow();
  });

  it("should accept mixed case paths", () => {
    process.env.APPDATA = "C:/Users/TestUser/AppData/Roaming";
    process.env.LOCALAPPDATA = "C:/Users/TestUser/AppData/Local";

    // Test mixed case
    process.env.FULMEN_CONFIG_HOME = "C:/USERS/testuser/AppData/Roaming/fulmen/config";

    expect(() => getFulmenConfigDir({ customHomeDir: "C:/Users/TestUser" })).not.toThrow();
  });

  it("should reject paths outside home directory", () => {
    process.env.APPDATA = "C:/Users/TestUser/AppData/Roaming";
    process.env.LOCALAPPDATA = "C:/Users/TestUser/AppData/Local";

    // Test different drive letter (outside home)
    process.env.FULMEN_CONFIG_HOME = "D:/invalid/path";

    expect(() => getFulmenConfigDir({ customHomeDir: "C:/Users/TestUser" })).toThrow();
  });

  it("should validate all FULMEN environment variables consistently", () => {
    process.env.APPDATA = "C:/Users/TestUser/AppData/Roaming";
    process.env.LOCALAPPDATA = "C:/Users/TestUser/AppData/Local";

    // Test FULMEN_DATA_HOME
    process.env.FULMEN_DATA_HOME = "D:/invalid/data";
    expect(() => getFulmenConfigDir({ customHomeDir: "C:/Users/TestUser" })).toThrow();

    // Reset and test FULMEN_CACHE_HOME
    delete process.env.FULMEN_DATA_HOME;
    process.env.FULMEN_CACHE_HOME = "D:/invalid/cache";
    expect(() => getFulmenConfigDir({ customHomeDir: "C:/Users/TestUser" })).toThrow();
  });

  it("should accept valid Windows paths within home directory", () => {
    process.env.APPDATA = "C:/Users/TestUser/AppData/Roaming";
    process.env.LOCALAPPDATA = "C:/Users/TestUser/AppData/Local";

    // Test valid path within home
    process.env.FULMEN_CONFIG_HOME = "C:/Users/TestUser/AppData/Roaming/fulmen/config";

    const configDir = getFulmenConfigDir({
      customHomeDir: "C:/Users/TestUser",
    });
    expect(configDir).toContain("fulmen");
  });
});
