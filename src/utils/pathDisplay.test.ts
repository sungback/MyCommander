import { beforeEach, describe, expect, it } from "vitest";
import { getBreadcrumbDisplayLabel, getPathDisplayName } from "./pathDisplay";

describe("pathDisplay", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
  });

  it("uses Macintosh HD for the macOS root path", () => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });

    expect(getPathDisplayName("/")).toBe("Macintosh HD");
    expect(getBreadcrumbDisplayLabel("/", "/")).toBe("Macintosh HD");
  });

  it("keeps non-root paths and drive roots readable", () => {
    expect(getPathDisplayName("/Users/back/Documents")).toBe("Documents");
    expect(getPathDisplayName("C:\\")).toBe("C:\\");
  });
});
