import { describe, expect, it } from "vitest";
import type { FileEntry } from "../../types/file";
import {
  entryMatchesQuickFilter,
  filterEntriesByQuickFilter,
  normalizeQuickFilterQuery,
} from "./quickFilter";

const entries: FileEntry[] = [
  { name: "..", path: "/home", kind: "directory" },
  { name: "Documents", path: "/home/user/Documents", kind: "directory" },
  { name: "Project Notes.md", path: "/home/user/Project Notes.md", kind: "file" },
  { name: "스크린샷.png", path: "/home/user/스크린샷.png", kind: "file" },
];

describe("quickFilter", () => {
  it("normalizes spacing, case, and Unicode composition", () => {
    expect(normalizeQuickFilterQuery("  PROJ  ")).toBe("proj");
    expect(normalizeQuickFilterQuery("가")).toBe("가");
  });

  it("matches file names case-insensitively using all query terms", () => {
    expect(
      entries
        .filter((entry) => entryMatchesQuickFilter(entry, "project md"))
        .map((entry) => entry.name)
    ).toEqual(["Project Notes.md"]);
  });

  it("filters parent entries out while a query is active", () => {
    expect(filterEntriesByQuickFilter(entries, "home")).toEqual([]);
    expect(filterEntriesByQuickFilter(entries, "")).toBe(entries);
  });

  it("matches Korean filenames after NFC normalization", () => {
    expect(filterEntriesByQuickFilter(entries, "스크린")).toEqual([
      entries[3],
    ]);
  });
});
