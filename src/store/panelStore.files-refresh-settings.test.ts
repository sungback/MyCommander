import { describe, expect, it } from 'vitest';
import { registerPanelStoreReset, usePanelStore } from './panelStore.test-harness';

registerPanelStoreReset();

describe("panelStore — sorting", () => {
  it("setSort toggles direction on same field", () => {
    const { setSort } = usePanelStore.getState();
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");

    setSort("left", "name");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("desc");

    setSort("left", "name");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");
  });

  it("setSort changes field and resets to asc", () => {
    const { setSort } = usePanelStore.getState();
    setSort("left", "name"); // now desc
    setSort("left", "size"); // different field, should be asc
    expect(usePanelStore.getState().leftPanel.sortField).toBe("size");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("asc");
  });

  it("setSort resets cursor to 0", () => {
    const { setCursor, setSort } = usePanelStore.getState();
    setCursor("left", 5);
    setSort("left", "size");
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(0);
  });
});

describe("panelStore — setFiles", () => {
  it("sorts directories before files", () => {
    const { setFiles } = usePanelStore.getState();
    setFiles("left", [
      { name: "zeta.txt", path: "/zeta.txt", kind: "file" },
      { name: "alpha", path: "/alpha", kind: "directory" },
      { name: "beta.txt", path: "/beta.txt", kind: "file" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files[0].kind).toBe("directory");
    expect(files[0].name).toBe("alpha");
  });

  it("keeps '..' entry at the top", () => {
    const { setFiles } = usePanelStore.getState();
    setFiles("left", [
      { name: "file.txt", path: "/file.txt", kind: "file" },
      { name: "..", path: "/", kind: "directory" },
      { name: "dir", path: "/dir", kind: "directory" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files[0].name).toBe("..");
  });
});

describe("panelStore — updateEntrySize", () => {
  it("updates entry size in both panels", () => {
    const { setFiles, updateEntrySize } = usePanelStore.getState();

    setFiles("left", [
      { name: "folder", path: "/shared/folder", kind: "directory" },
    ]);
    setFiles("right", [
      { name: "folder", path: "/shared/folder", kind: "directory" },
    ]);

    updateEntrySize("left", "/shared/folder", 9999);

    const leftFiles = usePanelStore.getState().leftPanel.files;
    const rightFiles = usePanelStore.getState().rightPanel.files;

    expect(leftFiles.find((f) => f.name === "folder")?.size).toBe(9999);
    expect(rightFiles.find((f) => f.name === "folder")?.size).toBe(9999);
  });

  it("caches the size for future setFiles calls", () => {
    const { setFiles, updateEntrySize } = usePanelStore.getState();

    updateEntrySize("left", "/cached/dir", 5000);

    // New setFiles should apply cached size
    setFiles("left", [
      { name: "dir", path: "/cached/dir", kind: "directory" },
    ]);

    const files = usePanelStore.getState().leftPanel.files;
    expect(files.find((f) => f.name === "dir")?.size).toBe(5000);
  });

  it("sizeCache에 경로-크기가 직접 저장된다", () => {
    const { updateEntrySize } = usePanelStore.getState();
    updateEntrySize("left", "/some/dir", 1234);
    // sizeCache는 FileList의 getVisibleRows가 직접 읽는 공유 캐시
    expect(usePanelStore.getState().sizeCache["/some/dir"]).toBe(1234);
  });

  it("파일 목록에 없는 경로도 sizeCache에 저장된다", () => {
    const { updateEntrySize } = usePanelStore.getState();
    // 양쪽 패널에 해당 경로 없음 → 파일 업데이트는 없지만 캐시에는 저장
    updateEntrySize("left", "/not/in/panel", 777);
    expect(usePanelStore.getState().sizeCache["/not/in/panel"]).toBe(777);
  });

  it("동일 경로에 updateEntrySize 두 번 호출 → 최신 값으로 덮어씌워진다", () => {
    const { updateEntrySize } = usePanelStore.getState();
    updateEntrySize("left", "/dir", 100);
    updateEntrySize("left", "/dir", 200);
    expect(usePanelStore.getState().sizeCache["/dir"]).toBe(200);
  });
});

describe("panelStore — setCursor", () => {
  it("updates cursor index", () => {
    const { setCursor } = usePanelStore.getState();
    setCursor("left", 3);
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(3);
  });
});

describe("panelStore — refreshPanel", () => {
  it("updates lastUpdated timestamp", () => {
    const before = usePanelStore.getState().leftPanel.lastUpdated;
    // Small delay to ensure different timestamp
    usePanelStore.getState().refreshPanel("left");
    const after = usePanelStore.getState().leftPanel.lastUpdated;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("keeps focus on the pending file name after a refresh reload", () => {
    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: {
        ...state.leftPanel,
        cursorIndex: 1,
        files: [
          { name: "..", path: "/home", kind: "directory" },
          { name: "archive.zip", path: "/home/user/archive.zip", kind: "file", size: 1 },
        ],
        tabs: state.leftPanel.tabs.map((tab) =>
          tab.id === state.leftPanel.activeTabId
            ? {
                ...tab,
                cursorIndex: 1,
                files: [
                  { name: "..", path: "/home", kind: "directory" },
                  { name: "archive.zip", path: "/home/user/archive.zip", kind: "file", size: 1 },
                ],
              }
            : tab
        ),
      },
    }));

    usePanelStore.getState().setPendingCursorName("left", "archive.zip");
    usePanelStore.getState().setFiles("left", [
      { name: "..", path: "/home", kind: "directory" },
      { name: "archive", path: "/home/user/archive", kind: "directory", size: null },
      { name: "archive.zip", path: "/home/user/archive.zip", kind: "file", size: 1 },
    ]);

    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(2);
  });

  it("keeps the panel-level pending cursor name in sync with the active tab", () => {
    usePanelStore.getState().setPendingCursorName("left", "archive.zip");

    const state = usePanelStore.getState();
    const activeTab = state.leftPanel.tabs.find(
      (tab) => tab.id === state.leftPanel.activeTabId
    );

    expect(activeTab?.pendingCursorName).toBe("archive.zip");
    expect(state.leftPanel.pendingCursorName).toBe("archive.zip");
  });
});

describe("panelStore — settings", () => {
  it("setShowHiddenFiles toggles the flag", () => {
    const { setShowHiddenFiles } = usePanelStore.getState();
    setShowHiddenFiles(true);
    expect(usePanelStore.getState().showHiddenFiles).toBe(true);

    setShowHiddenFiles(false);
    expect(usePanelStore.getState().showHiddenFiles).toBe(false);
  });

  it("setThemePreference changes theme", () => {
    const { setThemePreference } = usePanelStore.getState();
    setThemePreference("dark");
    expect(usePanelStore.getState().themePreference).toBe("dark");

    setThemePreference("light");
    expect(usePanelStore.getState().themePreference).toBe("light");

    setThemePreference("auto");
    expect(usePanelStore.getState().themePreference).toBe("auto");

  });
});
