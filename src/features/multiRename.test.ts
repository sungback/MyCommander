import { describe, expect, it } from "vitest";
import {
  buildMultiRenamePreview,
  buildMultiRenameSession,
  defaultMultiRenameOptions,
  getBatchRenameOperations,
} from "./multiRename";

describe("multiRename", () => {
  it("선택된 항목을 패널 순서대로 세션으로 만든다", () => {
    const session = buildMultiRenameSession("left", {
      id: "left",
      tabs: [],
      activeTabId: "tab",
      currentPath: "/home/user",
      history: [],
      historyIndex: -1,
      files: [
        { name: "..", path: "/home", kind: "directory" },
        { name: "b.txt", path: "/home/user/b.txt", kind: "file" },
        { name: "a.txt", path: "/home/user/a.txt", kind: "file" },
      ],
      selectedItems: new Set(["/home/user/a.txt", "/home/user/b.txt"]),
      cursorIndex: 0,
      sortField: "name",
      sortDirection: "asc",
      lastUpdated: 0,
      pendingCursorName: null,
    });

    expect(session.items.map((item) => item.name)).toEqual(["b.txt", "a.txt"]);
  });

  const panelWith = (selected: string[], cursorIndex: number) => ({
    id: "left" as const,
    tabs: [],
    activeTabId: "tab",
    currentPath: "/home/user",
    history: [],
    historyIndex: -1,
    files: [
      { name: "..", path: "/home", kind: "directory" as const },
      { name: "a.txt", path: "/home/user/a.txt", kind: "file" as const },
    ],
    selectedItems: new Set(selected),
    cursorIndex,
    sortField: "name" as const,
    sortDirection: "asc" as const,
    lastUpdated: 0,
    pendingCursorName: null,
  });

  it("선택이 없으면 커서 항목을 대상으로 한다", () => {
    const session = buildMultiRenameSession("left", panelWith([], 1));
    expect(session.items.map((item) => item.name)).toEqual(["a.txt"]);
  });

  it("선택이 전부 펼친 하위 항목이면 커서 항목으로 대체하지 않는다", () => {
    const session = buildMultiRenameSession("left", panelWith(["/home/user/sub/child.txt"], 1));
    expect(session.items).toEqual([]);
  });

  it("커서가 ..이고 선택이 없으면 빈 목록이다", () => {
    const session = buildMultiRenameSession("left", panelWith([], 0));
    expect(session.items).toEqual([]);
  });

  it("마스크와 카운터로 새 이름 미리보기를 만든다", () => {
    const preview = buildMultiRenamePreview(
      {
        panelId: "left",
        directoryPath: "/home/user",
        siblingNames: ["alpha.txt", "beta.txt"],
        items: [
          { path: "/home/user/alpha.txt", name: "alpha.txt", kind: "file" },
          { path: "/home/user/beta.txt", name: "beta.txt", kind: "file" },
        ],
      },
      {
        ...defaultMultiRenameOptions,
        nameMask: "사진_[C]",
        extensionMask: "jpg",
        counterPadding: 2,
      }
    );

    expect(preview.map((row) => row.newName)).toEqual(["사진_01.jpg", "사진_02.jpg"]);
    expect(getBatchRenameOperations(preview)).toEqual([
      { oldPath: "/home/user/alpha.txt", newPath: "/home/user/사진_01.jpg" },
      { oldPath: "/home/user/beta.txt", newPath: "/home/user/사진_02.jpg" },
    ]);
  });

  it("같은 이름 충돌을 오류로 표시한다", () => {
    const preview = buildMultiRenamePreview(
      {
        panelId: "left",
        directoryPath: "/home/user",
        siblingNames: ["alpha.txt", "beta.txt"],
        items: [
          { path: "/home/user/alpha.txt", name: "alpha.txt", kind: "file" },
          { path: "/home/user/beta.txt", name: "beta.txt", kind: "file" },
        ],
      },
      {
        ...defaultMultiRenameOptions,
        nameMask: "same",
        extensionMask: "txt",
      }
    );

    expect(preview.every((row) => row.error === "같은 이름이 둘 이상 생성됩니다.")).toBe(true);
  });
});
