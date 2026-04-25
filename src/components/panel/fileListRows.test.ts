import { describe, expect, it } from "vitest";
import type { FileEntry } from "../../types/file";
import { getVisibleRows, isSelectableEntry } from "./fileListRows";

describe("fileListRows", () => {
  it("builds visible rows with cached sizes and sorted expanded children", () => {
    const entries: FileEntry[] = [
      { name: "docs", path: "/root/docs", kind: "directory", size: null },
      { name: "notes.txt", path: "/root/notes.txt", kind: "file", size: 12 },
    ];
    const children: FileEntry[] = [
      { name: "..", path: "/root", kind: "directory" },
      { name: "zeta.txt", path: "/root/docs/zeta.txt", kind: "file", size: 4 },
      { name: "alpha", path: "/root/docs/alpha", kind: "directory", size: null },
    ];

    const rows = getVisibleRows({
      entries,
      expandedPaths: new Set(["/root/docs"]),
      childEntriesByPath: {
        "/root/docs": children,
      },
      sizeCache: {
        "/root/docs": 100,
        "/root/docs/alpha": 2048,
      },
      sortField: "name",
      sortDirection: "asc",
    });

    expect(
      rows.map((row) => ({
        path: row.entry.path,
        size: row.entry.size,
        depth: row.depth,
        canExpand: row.canExpand,
        isExpanded: row.isExpanded,
      }))
    ).toEqual([
      {
        path: "/root/docs",
        size: 100,
        depth: 0,
        canExpand: true,
        isExpanded: true,
      },
      {
        path: "/root/docs/alpha",
        size: 2048,
        depth: 1,
        canExpand: true,
        isExpanded: false,
      },
      {
        path: "/root/docs/zeta.txt",
        size: 4,
        depth: 1,
        canExpand: false,
        isExpanded: false,
      },
      {
        path: "/root/notes.txt",
        size: 12,
        depth: 0,
        canExpand: false,
        isExpanded: false,
      },
    ]);
  });

  it("treats parent directory entries as non-selectable", () => {
    expect(isSelectableEntry({ name: "..", path: "/root", kind: "directory" })).toBe(
      false
    );
    expect(
      isSelectableEntry({ name: "docs", path: "/root/docs", kind: "directory" })
    ).toBe(true);
  });
});
