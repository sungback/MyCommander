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
    expect(leftFiles.find((f) => f.name === "folder")?.sizeStatus).toBe("exact");
    expect(rightFiles.find((f) => f.name === "folder")?.size).toBe(9999);
    expect(rightFiles.find((f) => f.name === "folder")?.sizeStatus).toBe("exact");
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
    expect(files.find((f) => f.name === "dir")?.sizeStatus).toBe("exact");
  });

  it("sizeCache에 경로-크기가 직접 저장된다", () => {
    const { updateEntrySize } = usePanelStore.getState();
    updateEntrySize("left", "/some/dir", 1234);
    // sizeCache는 FileList의 getVisibleRows가 직접 읽는 공유 캐시
    expect(usePanelStore.getState().sizeCache["/some/dir"]).toBe(1234);
    expect(usePanelStore.getState().sizeStatusCache["/some/dir"]).toBe("exact");
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

  it("동일한 크기 업데이트는 패널과 캐시 상태를 다시 만들지 않는다", () => {
    const { setFiles, updateEntrySize } = usePanelStore.getState();

    setFiles("left", [
      { name: "dir", path: "/same/dir", kind: "directory" },
    ]);
    updateEntrySize("left", "/same/dir", 100);

    const afterFirstUpdate = usePanelStore.getState();
    let notificationCount = 0;
    const unsubscribe = usePanelStore.subscribe(() => {
      notificationCount += 1;
    });

    updateEntrySize("left", "/same/dir", 100);
    unsubscribe();

    const afterSecondUpdate = usePanelStore.getState();
    expect(afterSecondUpdate.leftPanel).toBe(afterFirstUpdate.leftPanel);
    expect(afterSecondUpdate.rightPanel).toBe(afterFirstUpdate.rightPanel);
    expect(afterSecondUpdate.sizeCache).toBe(afterFirstUpdate.sizeCache);
    expect(afterSecondUpdate.sizeStatusCache).toBe(afterFirstUpdate.sizeStatusCache);
    expect(notificationCount).toBe(0);
  });

  it("stores estimated directory sizes separately from exact calculations", () => {
    const { setFiles, updateEntrySizeEstimate } = usePanelStore.getState();

    setFiles("left", [
      { name: "dir", path: "/estimated/dir", kind: "directory" },
    ]);

    updateEntrySizeEstimate("left", "/estimated/dir", 123, "partial");

    const file = usePanelStore
      .getState()
      .leftPanel.files.find((entry) => entry.name === "dir");

    expect(file?.size).toBe(123);
    expect(file?.sizeStatus).toBe("partial");
    expect(usePanelStore.getState().sizeCache["/estimated/dir"]).toBe(123);
    expect(usePanelStore.getState().sizeStatusCache["/estimated/dir"]).toBe("partial");
  });

  it("hydrates persistent cached directory sizes and marks stale exact values as estimated", () => {
    const { hydrateEntrySizesFromCache, setFiles } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      {
        path: "/cached/stale",
        size: 1234,
        status: "exact",
        isStale: true,
      },
      {
        path: "/cached/fresh",
        size: 5678,
        status: "exact",
        isStale: false,
      },
    ]);

    setFiles("left", [
      { name: "stale", path: "/cached/stale", kind: "directory" },
      { name: "fresh", path: "/cached/fresh", kind: "directory" },
    ]);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/cached/stale"]).toBe(1234);
    expect(state.sizeStatusCache["/cached/stale"]).toBe("estimated");
    expect(state.sizeCacheStale["/cached/stale"]).toBe(true);
    expect(state.leftPanel.files.find((entry) => entry.name === "stale")?.sizeStatus).toBe(
      "estimated"
    );
    expect(state.sizeCache["/cached/fresh"]).toBe(5678);
    expect(state.sizeStatusCache["/cached/fresh"]).toBe("exact");
    expect(state.sizeCacheStale["/cached/fresh"]).toBe(false);
  });

  it("clears stale flags when an exact size is recalculated", () => {
    const { hydrateEntrySizesFromCache, updateEntrySize } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      {
        path: "/cached/stale",
        size: 1234,
        status: "exact",
        isStale: true,
      },
    ]);

    updateEntrySize("left", "/cached/stale", 2000);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/cached/stale"]).toBe(2000);
    expect(state.sizeStatusCache["/cached/stale"]).toBe("exact");
    expect(state.sizeCacheStale["/cached/stale"]).toBe(false);
  });

  it("marks cached exact ancestors stale when a descendant exact size changes", () => {
    const { hydrateEntrySizesFromCache, setFiles, updateEntrySize } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/app", size: 11_000, status: "exact", isStale: false },
      { path: "/work/app/target", size: 10_000, status: "exact", isStale: false },
      { path: "/work/other", size: 500, status: "exact", isStale: false },
    ]);
    setFiles("left", [
      { name: "app", path: "/work/app", kind: "directory" },
      { name: "other", path: "/work/other", kind: "directory" },
    ]);

    updateEntrySize("left", "/work/app/target", 10);

    const state = usePanelStore.getState();
    expect(state.sizeStatusCache["/work/app"]).toBe("estimated");
    expect(state.sizeCacheStale["/work/app"]).toBe(true);
    expect(state.leftPanel.files.find((entry) => entry.name === "app")?.sizeStatus).toBe(
      "estimated"
    );
    expect(state.sizeStatusCache["/work/other"]).toBe("exact");
    expect(state.sizeCacheStale["/work/other"]).toBe(false);
  });

  it("keeps cached exact ancestors when a descendant exact size is unchanged", () => {
    const { hydrateEntrySizesFromCache, updateEntrySize } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/app", size: 11_000, status: "exact", isStale: false },
      { path: "/work/app/target", size: 10_000, status: "exact", isStale: false },
    ]);

    updateEntrySize("left", "/work/app/target", 10_000);

    const state = usePanelStore.getState();
    expect(state.sizeStatusCache["/work/app"]).toBe("exact");
    expect(state.sizeCacheStale["/work/app"]).toBe(false);
  });

  it("does not shrink a displayed directory size while a rescan is in progress", () => {
    const { hydrateEntrySizesFromCache, updateEntrySize, updateEntrySizeProgress } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/big", size: 8_000, status: "exact", isStale: false },
    ]);

    updateEntrySizeProgress("left", "/work/big", 100);
    expect(usePanelStore.getState().sizeCache["/work/big"]).toBe(8_000);

    updateEntrySizeProgress("left", "/work/big", 9_000);
    expect(usePanelStore.getState().sizeCache["/work/big"]).toBe(9_000);

    updateEntrySize("left", "/work/big", 8_500);
    expect(usePanelStore.getState().sizeCache["/work/big"]).toBe(8_500);
  });

  it("compares against the pre-progress size when progress events overwrote the cache", () => {
    const {
      hydrateEntrySizesFromCache,
      updateEntrySize,
      updateEntrySizeProgress,
    } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/app", size: 11_000, status: "exact", isStale: false },
      { path: "/work/app/target", size: 10_000, status: "exact", isStale: false },
    ]);

    updateEntrySizeProgress("left", "/work/app/target", 10);
    updateEntrySize("left", "/work/app/target", 10);

    expect(usePanelStore.getState().sizeCacheStale["/work/app"]).toBe(true);
  });

  it("marks changed directories and ancestors stale while keeping their sizes", () => {
    const { hydrateEntrySizesFromCache, setFiles, markEntrySizesStale } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work", size: 5_000, status: "exact", isStale: false },
      { path: "/work/app", size: 4_000, status: "exact", isStale: false },
      { path: "/other", size: 100, status: "exact", isStale: false },
    ]);
    setFiles("left", [{ name: "app", path: "/work/app", kind: "directory" }]);

    markEntrySizesStale(["/work/app/src/file.ts"]);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/work"]).toBe(5_000);
    expect(state.sizeStatusCache["/work"]).toBe("exact");
    expect(state.sizeCacheStale["/work"]).toBe(true);
    expect(state.sizeCacheStale["/work/app"]).toBe(true);
    expect(state.sizeCacheStale["/other"]).toBe(false);
    const entry = state.leftPanel.files.find((file) => file.name === "app");
    expect(entry?.size).toBe(4_000);
    expect(entry?.sizeStatus).toBe("exact");
  });

  it("stores limited sizes and keeps them over quick estimates", () => {
    const { setFiles, updateEntrySize, updateEntrySizeEstimate } = usePanelStore.getState();
    setFiles("left", [{ name: "Library", path: "/work/Library", kind: "directory" }]);

    updateEntrySize("left", "/work/Library", 5_000, undefined, "limited");
    updateEntrySizeEstimate("left", "/work/Library", 100, "estimated");

    const state = usePanelStore.getState();
    expect(state.sizeCache["/work/Library"]).toBe(5_000);
    expect(state.sizeStatusCache["/work/Library"]).toBe("limited");
    const entry = state.leftPanel.files.find((file) => file.name === "Library");
    expect(entry?.size).toBe(5_000);
    expect(entry?.sizeStatus).toBe("limited");
  });

  it("hydrates limited sizes and marks stale limited values as estimated", () => {
    const { hydrateEntrySizesFromCache } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/cached/limited", size: 10, status: "limited", isStale: false },
      { path: "/cached/old-limited", size: 20, status: "limited", isStale: true },
    ]);

    const state = usePanelStore.getState();
    expect(state.sizeStatusCache["/cached/limited"]).toBe("limited");
    expect(state.sizeStatusCache["/cached/old-limited"]).toBe("estimated");
    expect(state.sizeCacheStale["/cached/old-limited"]).toBe(true);
  });

  it("marks cached limited ancestors stale when a descendant size changes", () => {
    const { hydrateEntrySizesFromCache, updateEntrySize } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/home", size: 11_000, status: "limited", isStale: false },
      { path: "/work/home/target", size: 10_000, status: "exact", isStale: false },
    ]);

    updateEntrySize("left", "/work/home/target", 10);

    const state = usePanelStore.getState();
    expect(state.sizeStatusCache["/work/home"]).toBe("estimated");
    expect(state.sizeCacheStale["/work/home"]).toBe(true);
  });

  it("does not let a quick estimate overwrite a restored exact size", () => {
    const { hydrateEntrySizesFromCache, setFiles, updateEntrySizeEstimate } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/AppData", size: 9_000, status: "exact", isStale: false },
    ]);
    setFiles("left", [{ name: "AppData", path: "/work/AppData", kind: "directory" }]);

    updateEntrySizeEstimate("left", "/work/AppData", 100, "estimated");

    const state = usePanelStore.getState();
    expect(state.sizeCache["/work/AppData"]).toBe(9_000);
    expect(state.sizeStatusCache["/work/AppData"]).toBe("exact");
    const entry = state.leftPanel.files.find((file) => file.name === "AppData");
    expect(entry?.size).toBe(9_000);
    expect(entry?.sizeStatus).toBe("exact");
  });

  it("prefers a restored exact size over an estimate computed before the cache loaded", () => {
    const { hydrateEntrySizesFromCache, setFiles, updateEntrySizeEstimate } =
      usePanelStore.getState();

    setFiles("left", [{ name: "AppData", path: "/work/AppData", kind: "directory" }]);
    updateEntrySizeEstimate("left", "/work/AppData", 100, "estimated");

    hydrateEntrySizesFromCache([
      { path: "/work/AppData", size: 9_000, status: "exact", isStale: false },
    ]);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/work/AppData"]).toBe(9_000);
    expect(state.sizeStatusCache["/work/AppData"]).toBe("exact");
    const entry = state.leftPanel.files.find((file) => file.name === "AppData");
    expect(entry?.size).toBe(9_000);
  });

  it("keeps a directory stale when a change was reported during the exact scan", () => {
    const { hydrateEntrySizesFromCache, markEntrySizesStale, updateEntrySize } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/app", size: 4_000, status: "exact", isStale: true },
    ]);
    const scanStartedAt = Date.now() - 1_000;

    // 스캔 도중 이미 stale인 폴더에 다시 변경이 알려진 상황
    markEntrySizesStale(["/work/app/src/file.ts"]);
    updateEntrySize("left", "/work/app", 4_200, scanStartedAt);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/work/app"]).toBe(4_200);
    expect(state.sizeCacheStale["/work/app"]).toBe(true);
  });

  it("clears stale when no change was reported after the exact scan started", () => {
    const { hydrateEntrySizesFromCache, markEntrySizesStale, updateEntrySize } =
      usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work/app", size: 4_000, status: "exact", isStale: false },
    ]);
    markEntrySizesStale(["/work/app/src/file.ts"]);
    const scanStartedAt = Date.now() + 1_000;

    updateEntrySize("left", "/work/app", 4_200, scanStartedAt);

    expect(usePanelStore.getState().sizeCacheStale["/work/app"]).toBe(false);
  });

  it("ignores noisy directories when marking sizes stale on filesystem changes", () => {
    const { hydrateEntrySizesFromCache, markEntrySizesStale } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      { path: "/work", size: 9_000, status: "exact", isStale: false },
      { path: "/work/app", size: 8_000, status: "exact", isStale: false },
      { path: "/work/app/target", size: 7_000, status: "exact", isStale: false },
      { path: "/work/app/target/debug", size: 6_000, status: "exact", isStale: false },
      { path: "/work/app/src", size: 100, status: "exact", isStale: false },
    ]);

    // 빌드 산출물 변경: target과 상위 폴더는 stale로 만들지 않는다.
    markEntrySizesStale([
      "/work/app/target/debug/deps/lib.rlib",
      "/work/app/target/debug/deps",
    ]);

    let state = usePanelStore.getState();
    expect(state.sizeCacheStale["/work"]).toBe(false);
    expect(state.sizeCacheStale["/work/app"]).toBe(false);
    expect(state.sizeCacheStale["/work/app/target"]).toBe(false);
    // 노이즈 디렉터리 안쪽 폴더는 직접 보고 있을 수 있으므로 stale 처리한다.
    expect(state.sizeCacheStale["/work/app/target/debug"]).toBe(true);

    // target 자체가 지워진 경우: 이벤트의 부모 경로(/work/app)는 stale로 처리된다.
    markEntrySizesStale(["/work/app/target", "/work/app"]);

    state = usePanelStore.getState();
    expect(state.sizeCacheStale["/work/app"]).toBe(true);
    expect(state.sizeCacheStale["/work"]).toBe(true);
    expect(state.sizeCacheStale["/work/app/src"]).toBe(false);
  });

  it("invalidates stale persistent cache markers with size cache entries", () => {
    const { hydrateEntrySizesFromCache, invalidateEntrySizes } = usePanelStore.getState();

    hydrateEntrySizesFromCache([
      {
        path: "/cached/stale",
        size: 1234,
        status: "partial",
        isStale: true,
      },
    ]);

    invalidateEntrySizes(["/cached/stale/child.txt"]);

    const state = usePanelStore.getState();
    expect(state.sizeCache["/cached/stale"]).toBeUndefined();
    expect(state.sizeStatusCache["/cached/stale"]).toBeUndefined();
    expect(state.sizeCacheStale["/cached/stale"]).toBeUndefined();
  });

  it("immediately resorts panel files when directory size is estimated or calculated in size-sorted panel", () => {
    const { setFiles, setSort, updateEntrySizeEstimate, updateEntrySize } = usePanelStore.getState();

    setFiles("left", [
      { name: "dirA", path: "/test/dirA", kind: "directory" },
      { name: "dirB", path: "/test/dirB", kind: "directory" },
      { name: "dirC", path: "/test/dirC", kind: "directory" },
    ]);
    setSort("left", "size"); // asc
    setSort("left", "size"); // desc

    // Initially all undefined sizes (treated as 0)
    expect(usePanelStore.getState().leftPanel.sortField).toBe("size");
    expect(usePanelStore.getState().leftPanel.sortDirection).toBe("desc");

    // dirB gets estimated size 50MB
    updateEntrySizeEstimate("left", "/test/dirB", 50 * 1024 * 1024, "estimated");
    expect(usePanelStore.getState().leftPanel.files.map((f) => f.name)).toEqual(["dirB", "dirA", "dirC"]);

    // dirC gets exact size 100MB -> moves to top in desc order
    updateEntrySize("left", "/test/dirC", 100 * 1024 * 1024);
    expect(usePanelStore.getState().leftPanel.files.map((f) => f.name)).toEqual(["dirC", "dirB", "dirA"]);
  });

  it("immediately resorts panel files when directory size is invalidated in size-sorted panel", () => {
    const { setFiles, setSort, updateEntrySize, invalidateEntrySizes } = usePanelStore.getState();

    setFiles("left", [
      { name: "dirA", path: "/test/dirA", kind: "directory" },
      { name: "dirB", path: "/test/dirB", kind: "directory" },
    ]);
    setSort("left", "size");
    setSort("left", "size"); // desc

    updateEntrySize("left", "/test/dirA", 200);
    updateEntrySize("left", "/test/dirB", 100);
    expect(usePanelStore.getState().leftPanel.files.map((f) => f.name)).toEqual(["dirA", "dirB"]);

    // Invalidate dirA -> its size becomes undefined (0), so dirB (100) becomes top
    invalidateEntrySizes(["/test/dirA/subfile.txt"]);
    expect(usePanelStore.getState().leftPanel.files.map((f) => f.name)).toEqual(["dirB", "dirA"]);
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
