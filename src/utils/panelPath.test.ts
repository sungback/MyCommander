import { describe, expect, it } from "vitest";
import {
  arePanelAccessPathsEquivalent,
  getPanelAccessPath,
  getPanelDisplayPath,
} from "./panelPath";

describe("panelPath helpers", () => {
  it("keeps the display path separate from the filesystem access path", () => {
    const panel = {
      currentPath: "/Users/me/Dropbox",
      resolvedPath: "/Users/me/Library/CloudStorage/Dropbox",
    };

    expect(getPanelDisplayPath(panel)).toBe("/Users/me/Dropbox");
    expect(getPanelAccessPath(panel)).toBe("/Users/me/Library/CloudStorage/Dropbox");
  });

  it("falls back to the display path when no resolved path is available", () => {
    expect(getPanelAccessPath({ currentPath: "/current", resolvedPath: "" })).toBe(
      "/current"
    );
    expect(getPanelAccessPath({ currentPath: "/current", resolvedPath: null })).toBe(
      "/current"
    );
    expect(getPanelAccessPath({ currentPath: "/current" })).toBe("/current");
  });

  it("compares panels by their access paths", () => {
    expect(
      arePanelAccessPathsEquivalent(
        { currentPath: "/Users/me/Dropbox", resolvedPath: "/resolved/dropbox" },
        { currentPath: "/resolved/dropbox" }
      )
    ).toBe(true);
  });
});
