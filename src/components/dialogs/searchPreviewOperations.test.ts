import { describe, expect, it } from "vitest";
import {
  collapseSearchResults,
  filterRemovedSearchResults,
  isSearchResultDescendantOf,
  resolveSearchOperationTarget,
} from "./searchPreviewOperations";
import type { PanelState } from "../../types/file";

const makePanel = (
  currentPath: string,
  resolvedPath?: string
): PanelState =>
  ({
    currentPath,
    resolvedPath: resolvedPath ?? null,
    files: [],
    selectedItems: new Set<string>(),
    cursorIndex: 0,
  } as unknown as PanelState);

const file = (path: string, is_dir = false) => ({
  name: path.split(/[\\/]/).pop() ?? path,
  path,
  size: 0,
  is_dir,
});

describe("isSearchResultDescendantOf", () => {
  it("returns true for identical paths", () => {
    expect(isSearchResultDescendantOf("/a/b", "/a/b")).toBe(true);
  });

  it("returns true for direct child", () => {
    expect(isSearchResultDescendantOf("/a/b/c", "/a/b")).toBe(true);
  });

  it("returns false for sibling with same prefix letters", () => {
    expect(isSearchResultDescendantOf("/a/b-other", "/a/b")).toBe(false);
  });

  it("returns false for unrelated path", () => {
    expect(isSearchResultDescendantOf("/other", "/a/b")).toBe(false);
  });

  it("handles windows backslash separator", () => {
    expect(isSearchResultDescendantOf("/a\\b\\c", "/a\\b")).toBe(true);
  });
});

describe("collapseSearchResults", () => {
  it("keeps single item unchanged", () => {
    const results = [file("/a/b.txt")];
    expect(collapseSearchResults(results)).toEqual(results);
  });

  it("removes child file when its parent directory is present", () => {
    const dir = file("/a/b", true);
    const child = file("/a/b/c.txt");
    const result = collapseSearchResults([dir, child]);
    expect(result).toEqual([dir]);
  });

  it("keeps two unrelated items", () => {
    const a = file("/a/x.txt");
    const b = file("/b/y.txt");
    expect(collapseSearchResults([a, b])).toEqual([a, b]);
  });

  it("removes nested directory when ancestor directory is present", () => {
    const parent = file("/a", true);
    const nested = file("/a/b", true);
    expect(collapseSearchResults([parent, nested])).toEqual([parent]);
  });
});

describe("filterRemovedSearchResults", () => {
  it("removes exactly matched file", () => {
    const current = [file("/a/x.txt"), file("/a/y.txt")];
    const removed = [file("/a/x.txt")];
    expect(filterRemovedSearchResults(current, removed)).toEqual([file("/a/y.txt")]);
  });

  it("removes directory and all its descendants", () => {
    const dir = file("/a", true);
    const child = file("/a/b.txt");
    const unrelated = file("/c/d.txt");
    const current = [dir, child, unrelated];
    const result = filterRemovedSearchResults(current, [dir]);
    expect(result).toEqual([unrelated]);
  });

  it("keeps unrelated items when removing a file", () => {
    const current = [file("/a/x.txt"), file("/b/y.txt")];
    const removed = [file("/a/x.txt")];
    expect(filterRemovedSearchResults(current, removed)).toEqual([file("/b/y.txt")]);
  });
});

describe("resolveSearchOperationTarget", () => {
  it("returns absolute targetInput as-is", () => {
    const panel = makePanel("/panel/path");
    expect(resolveSearchOperationTarget("/absolute/target", panel)).toBe(
      "/absolute/target"
    );
  });

  it("joins relative targetInput onto panel path", () => {
    const panel = makePanel("/panel/path");
    expect(resolveSearchOperationTarget("subdir", panel)).toBe(
      "/panel/path/subdir"
    );
  });

  it("returns resolvedPath when targetInput equals panel.currentPath", () => {
    const panel = makePanel("/panel/path", "/resolved/path");
    expect(resolveSearchOperationTarget("/panel/path", panel)).toBe(
      "/resolved/path"
    );
  });
});
