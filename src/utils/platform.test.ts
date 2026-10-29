import { describe, expect, it } from "vitest";
import { getPlatformType, isMacPlatform } from "./platform";

describe("platform utility", () => {
  it("determines platform type and isMacPlatform", () => {
    // In Node/happy-dom or test environment
    expect(typeof isMacPlatform()).toBe("boolean");
    const platform = getPlatformType();
    expect(["macos", "windows", "linux"]).toContain(platform);
  });
});
