import { beforeEach, describe, expect, it, vi } from "vitest";
import { enterArchiveEntry, isArchiveEntry, isDmgEntry, isZipArchiveEntry } from "./archiveEnter";

describe("archiveEnter", () => {
  const setPath = vi.fn();
  const fs = {
    extractZip: vi.fn(),
    openFile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fs.extractZip.mockResolvedValue("/home/user/archive");
    fs.openFile.mockResolvedValue(undefined);
  });

  it("zip 파일은 압축 해제 후 추출 폴더로 진입한다", async () => {
    const handled = await enterArchiveEntry({
      entry: {
        name: "archive.zip",
        path: "/home/user/archive.zip",
        kind: "file",
      },
      fs,
      panelId: "left",
      setPath,
    });

    expect(handled).toBe(true);
    expect(fs.extractZip).toHaveBeenCalledWith("/home/user/archive.zip");
    expect(setPath).toHaveBeenCalledWith("left", "/home/user/archive");
    expect(fs.openFile).not.toHaveBeenCalled();
  });

  it("dmg 파일은 시스템으로 연다", async () => {
    const handled = await enterArchiveEntry({
      entry: {
        name: "disk.dmg",
        path: "/home/user/disk.dmg",
        kind: "file",
      },
      fs,
      panelId: "left",
      setPath,
    });

    expect(handled).toBe(true);
    expect(fs.openFile).toHaveBeenCalledWith("/home/user/disk.dmg");
    expect(setPath).not.toHaveBeenCalled();
  });

  it("압축 파일이 아니면 처리하지 않는다", async () => {
    const handled = await enterArchiveEntry({
      entry: {
        name: "notes.txt",
        path: "/home/user/notes.txt",
        kind: "file",
      },
      fs,
      panelId: "left",
      setPath,
    });

    expect(handled).toBe(false);
    expect(fs.extractZip).not.toHaveBeenCalled();
    expect(fs.openFile).not.toHaveBeenCalled();
    expect(setPath).not.toHaveBeenCalled();
  });

  it("확장자 판별은 대소문자를 구분하지 않는다", () => {
    expect(isZipArchiveEntry({ name: "ARCHIVE.ZIP" })).toBe(true);
    expect(isDmgEntry({ name: "DISK.DMG" })).toBe(true);
    expect(isArchiveEntry({ name: "ARCHIVE.ZIP" })).toBe(true);
    expect(isArchiveEntry({ name: "notes.txt" })).toBe(false);
  });
});
