import { describe, expect, it } from 'vitest';
import { registerPanelStoreReset, usePanelStore } from './panelStore.test-harness';

registerPanelStoreReset();

describe("panelStore — selection", () => {
  it("toggleSelection adds and removes paths", () => {
    const { toggleSelection } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    expect(usePanelStore.getState().leftPanel.selectedItems.has("/file1")).toBe(true);

    toggleSelection("left", "/file1");
    expect(usePanelStore.getState().leftPanel.selectedItems.has("/file1")).toBe(false);
  });

  it("selectOnly sets exactly one item", () => {
    const { toggleSelection, selectOnly } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    toggleSelection("left", "/file2");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(2);

    selectOnly("left", "/file1");
    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.size).toBe(1);
    expect(selected.has("/file1")).toBe(true);
  });

  it("selectOnly with null clears selection", () => {
    const { toggleSelection, selectOnly } = usePanelStore.getState();

    toggleSelection("left", "/file1");
    selectOnly("left", null);
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });

  it("clearSelection empties all selected items", () => {
    const { toggleSelection, clearSelection } = usePanelStore.getState();

    toggleSelection("left", "/a");
    toggleSelection("left", "/b");
    clearSelection("left");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });

  it("setSelection replaces all selections", () => {
    const { toggleSelection, setSelection } = usePanelStore.getState();

    toggleSelection("left", "/old");
    setSelection("left", ["/new1", "/new2"]);

    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has("/old")).toBe(false);
    expect(selected.has("/new1")).toBe(true);
    expect(selected.has("/new2")).toBe(true);
  });

  it("invertSelection inverts selection excluding ..", () => {
    const { setFiles, toggleSelection, invertSelection } = usePanelStore.getState();

    setFiles("left", [
      { name: "..", path: "/parent", kind: "directory" },
      { name: "file1.txt", path: "/parent/file1.txt", kind: "file" },
      { name: "file2.jpg", path: "/parent/file2.jpg", kind: "file" },
      { name: "file3.png", path: "/parent/file3.png", kind: "file" },
    ]);

    toggleSelection("left", "/parent/file1.txt");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(1);

    invertSelection("left");
    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has("/parent")).toBe(false); // ".." must never be selected
    expect(selected.has("/parent/file1.txt")).toBe(false);
    expect(selected.has("/parent/file2.jpg")).toBe(true);
    expect(selected.has("/parent/file3.png")).toBe(true);
  });

  it("selectByPattern selects and unselects matching files", () => {
    const { setFiles, selectByPattern } = usePanelStore.getState();

    setFiles("left", [
      { name: "..", path: "/dir/..", kind: "directory" },
      { name: "photo1.jpg", path: "/dir/photo1.jpg", kind: "file" },
      { name: "photo2.PNG", path: "/dir/photo2.PNG", kind: "file" },
      { name: "notes.txt", path: "/dir/notes.txt", kind: "file" },
      { name: "readme.md", path: "/dir/readme.md", kind: "file" },
    ]);

    // Select all images
    const selectedCount = selectByPattern("left", "*.jpg; *.png", "select");
    expect(selectedCount).toBe(2);

    let selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has("/dir/photo1.jpg")).toBe(true);
    expect(selected.has("/dir/photo2.PNG")).toBe(true);
    expect(selected.has("/dir/notes.txt")).toBe(false);

    // Unselect *.png
    const unselectedCount = selectByPattern("left", "*.png", "unselect");
    expect(unselectedCount).toBe(1);

    selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has("/dir/photo1.jpg")).toBe(true);
    expect(selected.has("/dir/photo2.PNG")).toBe(false);
  });
});

describe("panelStore — tabs", () => {
  it("addTab creates a new tab", () => {
    const initialTabCount = usePanelStore.getState().leftPanel.tabs.length;
    usePanelStore.getState().addTab("left");
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(initialTabCount + 1);
  });

  it("addTab switches to the new tab", () => {
    const oldActiveId = usePanelStore.getState().leftPanel.activeTabId;
    usePanelStore.getState().addTab("left");
    const newActiveId = usePanelStore.getState().leftPanel.activeTabId;
    expect(newActiveId).not.toBe(oldActiveId);
  });

  it("activateTab switches to the specified tab", () => {
    usePanelStore.getState().addTab("left");
    const tabs = usePanelStore.getState().leftPanel.tabs;
    const firstTabId = tabs[0].id;

    usePanelStore.getState().activateTab("left", firstTabId);
    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(firstTabId);
  });

  it("closeTab removes the tab", () => {
    usePanelStore.getState().addTab("left");
    const tabs = usePanelStore.getState().leftPanel.tabs;
    expect(tabs.length).toBe(2);

    usePanelStore.getState().closeTab("left", tabs[0].id);
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(1);
  });

  it("closeTab does nothing when only one tab remains", () => {
    const tabs = usePanelStore.getState().leftPanel.tabs;
    expect(tabs.length).toBe(1);

    usePanelStore.getState().closeTab("left", tabs[0].id);
    expect(usePanelStore.getState().leftPanel.tabs.length).toBe(1);
  });

  it("activateTab with non-existent id does nothing", () => {
    const before = usePanelStore.getState().leftPanel.activeTabId;
    usePanelStore.getState().activateTab("left", "non-existent-id");
    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(before);
  });

  it("addTab은 현재 패널 경로를 상속한다", () => {
    usePanelStore.getState().setPath("left", "/home/user/Documents");
    usePanelStore.getState().addTab("left");
    const tabs = usePanelStore.getState().leftPanel.tabs;
    const newTab = tabs[tabs.length - 1];
    expect(newTab.currentPath).toBe("/home/user/Documents");
  });

  it("활성 탭 닫기 → 이웃 탭으로 activeTabId 자동 전환", () => {
    usePanelStore.getState().addTab("left"); // 탭 2개
    const tabs = usePanelStore.getState().leftPanel.tabs;
    const activeId = usePanelStore.getState().leftPanel.activeTabId!;
    const otherId = tabs.find((t) => t.id !== activeId)!.id;

    usePanelStore.getState().closeTab("left", activeId);

    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(otherId);
    expect(usePanelStore.getState().leftPanel.tabs).toHaveLength(1);
  });

  it("비활성 탭 닫기 → activeTabId 변경 없음", () => {
    usePanelStore.getState().addTab("left");
    const activeId = usePanelStore.getState().leftPanel.activeTabId!;
    const tabs = usePanelStore.getState().leftPanel.tabs;
    const inactiveId = tabs.find((t) => t.id !== activeId)!.id;

    usePanelStore.getState().closeTab("left", inactiveId);

    expect(usePanelStore.getState().leftPanel.activeTabId).toBe(activeId);
    expect(usePanelStore.getState().leftPanel.tabs).toHaveLength(1);
  });
});
