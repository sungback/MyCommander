import { describe, expect, it } from "vitest";
import type { FileEntry } from "../types/file";
import {
  findSameExtensionPaths,
  formatSelectionForClipboard,
  getFileExtension,
  matchSelectionLines,
  orderPathsByFiles,
  serializeSelectionFile,
} from "./selectionText";

const file = (name: string, extra: Partial<FileEntry> = {}): FileEntry => ({
  name,
  path: `/dir/${name}`,
  kind: "file",
  size: 10,
  lastModified: null,
  ...extra,
});

const files: FileEntry[] = [
  file("..", { kind: "directory" }),
  file("a.PNG"),
  file("b.png"),
  file("c.txt"),
  file("README"),
  file(".gitignore"),
  file("photos", { kind: "directory" }),
];

describe("getFileExtension", () => {
  it("returns lowercase extension after the last dot", () => {
    expect(getFileExtension("archive.tar.GZ")).toBe("gz");
  });

  it("treats leading-dot and trailing-dot names as no extension", () => {
    expect(getFileExtension(".gitignore")).toBe("");
    expect(getFileExtension("name.")).toBe("");
    expect(getFileExtension("README")).toBe("");
  });
});

describe("findSameExtensionPaths", () => {
  it("selects files with the same extension ignoring case, excluding folders and ..", () => {
    expect(findSameExtensionPaths(files, files[1])).toEqual({
      extension: "png",
      paths: ["/dir/a.PNG", "/dir/b.png"],
    });
  });

  it("groups extensionless files together", () => {
    expect(findSameExtensionPaths(files, files[4])).toEqual({
      extension: "",
      paths: ["/dir/README", "/dir/.gitignore"],
    });
  });

  it("returns null for folders, .. and missing cursor", () => {
    expect(findSameExtensionPaths(files, files[6])).toBeNull();
    expect(findSameExtensionPaths(files, files[0])).toBeNull();
    expect(findSameExtensionPaths(files, undefined)).toBeNull();
  });
});

describe("formatSelectionForClipboard", () => {
  const paths = ["/dir/c.txt", "/dir/a.PNG", "/dir/missing/child.md"];

  it("orders by panel list and keeps unknown (expanded child) paths last", () => {
    expect(orderPathsByFiles(files, paths)).toEqual([
      "/dir/a.PNG",
      "/dir/c.txt",
      "/dir/missing/child.md",
    ]);
  });

  it("names mode uses entry name, falling back to path base name", () => {
    expect(formatSelectionForClipboard(files, paths, "names")).toBe("a.PNG\nc.txt\nchild.md");
  });

  it("paths mode returns full paths", () => {
    expect(formatSelectionForClipboard(files, paths, "paths")).toBe(
      "/dir/a.PNG\n/dir/c.txt\n/dir/missing/child.md"
    );
  });

  it("details mode is tab separated: name, ext, size, date; folders show <DIR>", () => {
    const dated = [file("x.txt", { size: 5, lastModified: new Date(2026, 10, 20, 11, 38).getTime() }), files[6]];
    expect(formatSelectionForClipboard(dated, [dated[0].path, dated[1].path], "details")).toBe(
      "x.txt\ttxt\t5\t2026.11.20 11:38\nphotos\t\t<DIR>\t"
    );
  });

  it("pathDetails mode puts the full path first", () => {
    expect(formatSelectionForClipboard(files, ["/dir/c.txt"], "pathDetails")).toBe(
      "/dir/c.txt\ttxt\t10\t"
    );
  });
});

describe("selection file", () => {
  it("serialize writes one path per line", () => {
    expect(serializeSelectionFile(["/a", "/b"])).toBe("/a\n/b\n");
  });

  it("matches by full path or by name, handles CRLF and NFD names", () => {
    const korean = file("한글.txt".normalize("NFC"));
    const list = [files[1], files[3], korean];
    const text = "/dir/a.PNG\r\nc.txt\r\n" + "한글.txt".normalize("NFD") + "\n\n";
    expect(matchSelectionLines(list, text)).toEqual([
      "/dir/a.PNG",
      "/dir/c.txt",
      korean.path,
    ]);
  });

  it("ignores .. and unknown lines", () => {
    expect(matchSelectionLines(files, "..\nnope.bin")).toEqual([]);
  });
});
