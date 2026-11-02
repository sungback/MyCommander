import { describe, expect, it, vi } from "vitest";
import {
  formatNfcRenameMessage,
  normalizePathsToNfc,
} from "./normalizeFilenamesToNfc";

const nfd = (text: string) => text.normalize("NFD");

describe("normalizePathsToNfc", () => {
  it("NFD 이름만 NFC로 바꾸고 이미 NFC인 항목은 건드리지 않는다", async () => {
    const renameFile = vi.fn().mockResolvedValue(undefined);

    const result = await normalizePathsToNfc(
      [`/work/${nfd("머신.txt")}`, "/work/plain.txt", "/work/머신러닝.txt"],
      renameFile
    );

    expect(renameFile).toHaveBeenCalledTimes(1);
    expect(renameFile).toHaveBeenCalledWith(
      `/work/${nfd("머신.txt")}`,
      "/work/머신.txt"
    );
    expect(result.converted).toEqual([`/work/${nfd("머신.txt")}`]);
    expect(result.unchanged).toBe(2);
    expect(result.parentDirectories).toEqual(["/work"]);
  });

  it("하위 경로를 먼저 바꿔 부모 이름이 바뀐 뒤에도 자식 경로가 유효하다", async () => {
    const calls: string[] = [];
    const renameFile = vi.fn(async (oldPath: string) => {
      calls.push(oldPath);
    });
    const parent = `/work/${nfd("폴더")}`;
    const child = `${parent}/${nfd("한글.txt")}`;

    await normalizePathsToNfc([parent, child], renameFile);

    expect(calls).toEqual([child, parent]);
  });

  it("하나가 실패해도 나머지를 계속 바꾸고 실패를 모아 돌려준다", async () => {
    const first = `/work/${nfd("가.txt")}`;
    const second = `/work/${nfd("나.txt")}`;
    const renameFile = vi.fn(async (oldPath: string) => {
      if (oldPath === first) {
        throw new Error("Target path already exists");
      }
    });

    const result = await normalizePathsToNfc([first, second], renameFile);

    expect(result.converted).toEqual([second]);
    expect(result.failed).toEqual([
      { path: first, message: "Target path already exists" },
    ]);
  });

  it("같은 경로를 여러 번 넘겨도 한 번만 바꾼다", async () => {
    const renameFile = vi.fn().mockResolvedValue(undefined);
    const path = `/work/${nfd("한글.txt")}`;

    await normalizePathsToNfc([path, path], renameFile);

    expect(renameFile).toHaveBeenCalledTimes(1);
  });

  it("Windows 경로 구분자도 처리한다", async () => {
    const renameFile = vi.fn().mockResolvedValue(undefined);

    await normalizePathsToNfc([`C:\\work\\${nfd("한글.txt")}`], renameFile);

    expect(renameFile).toHaveBeenCalledWith(
      `C:\\work\\${nfd("한글.txt")}`,
      "C:\\work\\한글.txt"
    );
  });

  it("바꿀 항목이 없으면 renameFile을 부르지 않는다", async () => {
    const renameFile = vi.fn();

    const result = await normalizePathsToNfc(["/work/a.txt"], renameFile);

    expect(renameFile).not.toHaveBeenCalled();
    expect(result.converted).toEqual([]);
  });
});

describe("formatNfcRenameMessage", () => {
  const base = { converted: [], failed: [], unchanged: 0, parentDirectories: [] };

  it("결과별 메시지를 만든다", () => {
    expect(formatNfcRenameMessage(base)).toBe("변환할 파일명이 없습니다 (이미 NFC)");
    expect(formatNfcRenameMessage({ ...base, converted: ["/a"] })).toBe(
      "파일명을 NFC로 변환했습니다."
    );
    expect(formatNfcRenameMessage({ ...base, converted: ["/a", "/b"] })).toBe(
      "2개 파일명을 NFC로 변환했습니다."
    );
    expect(
      formatNfcRenameMessage({ ...base, failed: [{ path: "/a", message: "x" }] })
    ).toBe("파일명을 NFC로 변환하지 못했습니다.");
    expect(
      formatNfcRenameMessage({
        ...base,
        converted: ["/a"],
        failed: [{ path: "/b", message: "x" }],
      })
    ).toBe("1개 변환, 1개 실패했습니다.");
  });
});
