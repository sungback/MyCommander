import { describe, it, expect } from "vitest";
import {
  arePathsEquivalent,
  getPathDirectoryName,
  joinPath,
  getParentPath,
  isWindowsPath,
  isAbsolutePath,
  getBreadcrumbParts,
  isSameOrNestedPath,
  normalizePathForComparison,
} from "./path";

describe("joinPath", () => {
  it("joins Unix paths", () => {
    expect(joinPath("/usr", "bin")).toBe("/usr/bin");
  });

  it("does not duplicate separator when base ends with /", () => {
    expect(joinPath("/usr/", "bin")).toBe("/usr/bin");
  });

  it("joins Windows paths", () => {
    expect(joinPath("C:\\Users", "docs")).toBe("C:\\Users\\docs");
  });

  it("does not duplicate separator when base ends with \\", () => {
    expect(joinPath("C:\\Users\\", "docs")).toBe("C:\\Users\\docs");
  });

  it("handles root path", () => {
    expect(joinPath("/", "home")).toBe("/home");
  });
});

describe("getParentPath", () => {
  it("returns parent of Unix path", () => {
    expect(getParentPath("/usr/local/bin")).toBe("/usr/local");
  });

  it("returns root when at top level on Unix", () => {
    expect(getParentPath("/usr")).toBe("/usr");
  });

  it("returns root itself for root path", () => {
    expect(getParentPath("/")).toBe("/");
  });

  it("returns parent of Windows path", () => {
    expect(getParentPath("C:\\Users\\test")).toBe("C:\\Users");
  });

  it("returns drive root when at top level on Windows", () => {
    expect(getParentPath("C:\\Users")).toBe("C:\\");
  });
});

describe("isWindowsPath", () => {
  it("detects Windows drive letters", () => {
    expect(isWindowsPath("C:\\Users")).toBe(true);
    expect(isWindowsPath("D:\\")).toBe(true);
  });

  it("detects paths with backslashes", () => {
    expect(isWindowsPath("some\\path")).toBe(true);
  });

  it("returns false for Unix paths", () => {
    expect(isWindowsPath("/usr/bin")).toBe(false);
    expect(isWindowsPath("/")).toBe(false);
  });
});

describe("isAbsolutePath", () => {
  it("detects Unix absolute paths", () => {
    expect(isAbsolutePath("/usr/bin")).toBe(true);
    expect(isAbsolutePath("/")).toBe(true);
  });

  it("detects Windows absolute paths", () => {
    expect(isAbsolutePath("C:\\Users")).toBe(true);
    expect(isAbsolutePath("C:/Users")).toBe(true);
  });

  it("returns false for relative paths", () => {
    expect(isAbsolutePath("relative/path")).toBe(false);
    expect(isAbsolutePath("file.txt")).toBe(false);
  });
});

describe("getPathDirectoryName", () => {
  it("returns parent directory for Unix file paths", () => {
    expect(getPathDirectoryName("/usr/local/file.txt")).toBe("/usr/local");
  });

  it("returns root for Unix top-level file paths", () => {
    expect(getPathDirectoryName("/file.txt")).toBe("/");
  });

  it("returns parent directory for Windows file paths", () => {
    expect(getPathDirectoryName("C:\\Users\\test\\file.txt")).toBe("C:\\Users\\test");
  });

  it("returns drive root for Windows top-level file paths", () => {
    expect(getPathDirectoryName("C:\\file.txt")).toBe("C:\\");
  });
});

describe("normalizePathForComparison", () => {
  it("normalizes Windows separators and casing", () => {
    expect(normalizePathForComparison("C:\\Users\\Back\\")).toBe("c:/users/back");
  });

  it("preserves Unix casing while trimming trailing separators", () => {
    expect(normalizePathForComparison("/Users/back/")).toBe("/Users/back");
  });
});

describe("arePathsEquivalent", () => {
  it("treats Windows paths with different case and separators as equal", () => {
    expect(arePathsEquivalent("C:\\Users\\Back", "c:/users/back/")).toBe(true);
  });

  it("treats Unix paths with trailing separators as equal", () => {
    expect(arePathsEquivalent("/tmp/work", "/tmp/work/")).toBe(true);
  });

  it("keeps Unix case-sensitive comparisons distinct", () => {
    expect(arePathsEquivalent("/Users/Back", "/users/back")).toBe(false);
  });
});

describe("isSameOrNestedPath", () => {
  it("detects nested Unix paths", () => {
    expect(isSameOrNestedPath("/tmp/work", "/tmp/work/sub")).toBe(true);
  });

  it("detects nested Windows paths", () => {
    expect(isSameOrNestedPath("C:\\Work", "c:/work/sub")).toBe(true);
  });

  it("rejects sibling paths", () => {
    expect(isSameOrNestedPath("/tmp/work", "/tmp/other")).toBe(false);
  });
});

describe("getBreadcrumbParts", () => {
  it("returns empty array for empty string", () => {
    expect(getBreadcrumbParts("")).toEqual([]);
  });

  it("generates parts for Unix path", () => {
    const parts = getBreadcrumbParts("/usr/local/bin");
    expect(parts).toEqual([
      { label: "/", path: "/" },
      { label: "usr", path: "/usr" },
      { label: "local", path: "/usr/local" },
      { label: "bin", path: "/usr/local/bin" },
    ]);
  });

  it("generates parts for root path", () => {
    const parts = getBreadcrumbParts("/");
    expect(parts).toEqual([{ label: "/", path: "/" }]);
  });

  it("generates parts for Windows path", () => {
    const parts = getBreadcrumbParts("C:\\Users\\test");
    expect(parts).toEqual([
      { label: "C:\\", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "test", path: "C:\\Users\\test" },
    ]);
  });

  it("generates parts for Windows drive root", () => {
    const parts = getBreadcrumbParts("C:\\");
    expect(parts).toEqual([{ label: "C:\\", path: "C:\\" }]);
  });
});
