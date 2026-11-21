import { describe, expect, it } from "vitest";
import type {
  ChecksumFileResult,
  ChecksumVerifyEntry,
} from "../hooks/tauriCommands/checksumCommands";
import {
  formatChecksumClipboardText,
  formatChecksumFileText,
  getChecksumFileExtension,
  getChecksumProgressPercent,
  isChecksumFileName,
  summarizeVerifyEntries,
} from "./checksumFormat";

const results: ChecksumFileResult[] = [
  {
    path: "/d/a.bin",
    name: "a.bin",
    hashes: [
      { algorithm: "md5", value: "m1" },
      { algorithm: "crc32", value: "c1" },
    ],
    error: null,
  },
  { path: "/d/dir", name: "dir", hashes: [], error: "folder" },
  {
    path: "/d/b b.bin",
    name: "b b.bin",
    hashes: [
      { algorithm: "md5", value: "m2" },
      { algorithm: "crc32", value: "c2" },
    ],
    error: null,
  },
];

describe("checksum format", () => {
  it("writes GNU lines for hash algorithms and skips failed files", () => {
    expect(formatChecksumFileText(results, "md5")).toBe("m1 *a.bin\nm2 *b b.bin\n");
  });

  it("writes SFV lines for crc32", () => {
    expect(formatChecksumFileText(results, "crc32")).toBe("a.bin c1\nb b.bin c2\n");
  });

  it("returns an empty string when nothing matches", () => {
    expect(formatChecksumFileText(results, "sha256")).toBe("");
  });

  it("concatenates selected algorithms for the clipboard", () => {
    expect(formatChecksumClipboardText(results, ["md5", "sha256", "crc32"])).toBe(
      "m1 *a.bin\nm2 *b b.bin\na.bin c1\nb b.bin c2"
    );
  });

  it("maps algorithms to file extensions", () => {
    expect(getChecksumFileExtension("crc32")).toBe("sfv");
    expect(getChecksumFileExtension("sha256")).toBe("sha256");
  });

  it("detects checksum file names", () => {
    expect(isChecksumFileName("SHA256.SHA256")).toBe(true);
    expect(isChecksumFileName("a.sfv")).toBe(true);
    expect(isChecksumFileName("a.txt")).toBe(false);
    expect(isChecksumFileName(".md5")).toBe(false);
  });

  it("summarizes verify statuses", () => {
    const entry = (status: ChecksumVerifyEntry["status"]): ChecksumVerifyEntry => ({
      name: "n",
      path: "p",
      algorithm: "md5",
      expected: "e",
      actual: null,
      status,
      error: null,
    });
    expect(
      summarizeVerifyEntries([entry("ok"), entry("ok"), entry("mismatch"), entry("missing")])
    ).toEqual({ ok: 2, mismatch: 1, missing: 1, error: 0 });
  });
});

describe("getChecksumProgressPercent", () => {
  it("읽은 비율을 정수 퍼센트로 내린다", () => {
    expect(getChecksumProgressPercent(0, 200)).toBe(0);
    expect(getChecksumProgressPercent(99, 200)).toBe(49);
    expect(getChecksumProgressPercent(200, 200)).toBe(100);
  });

  it("크기가 0이거나 모르면 0, 초과해도 100을 넘지 않는다", () => {
    expect(getChecksumProgressPercent(0, 0)).toBe(0);
    expect(getChecksumProgressPercent(5, 0)).toBe(0);
    expect(getChecksumProgressPercent(300, 200)).toBe(100);
  });
});
