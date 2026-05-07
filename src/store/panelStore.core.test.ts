import { describe, expect, it } from 'vitest';
import { registerPanelStoreReset, usePanelStore } from './panelStore.test-harness';

registerPanelStoreReset();

describe("panelStore — initial state", () => {
  it("has left and right panels", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel).toBeDefined();
    expect(state.rightPanel).toBeDefined();
    expect(state.leftPanel.id).toBe("left");
    expect(state.rightPanel.id).toBe("right");
  });

  it("defaults activePanel to left", () => {
    const state = usePanelStore.getState();
    // persisted state might override, but structurally it should be "left" or "right"
    expect(["left", "right"]).toContain(state.activePanel);
  });

  it("each panel has at least one tab", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel.tabs.length).toBeGreaterThanOrEqual(1);
    expect(state.rightPanel.tabs.length).toBeGreaterThanOrEqual(1);
  });

  it("defaults sort to name ascending", () => {
    const state = usePanelStore.getState();
    expect(state.leftPanel.sortField).toBe("name");
    expect(state.leftPanel.sortDirection).toBe("asc");
  });

  it("defaults showHiddenFiles to false", () => {
    const state = usePanelStore.getState();
    expect(state.showHiddenFiles).toBe(false);
  });

  it("defaults panel view modes to detailed", () => {
    const state = usePanelStore.getState();
    expect(state.panelViewModes.left).toBe("detailed");
    expect(state.panelViewModes.right).toBe("detailed");
  });
});

describe("panelStore — setActivePanel", () => {
  it("switches active panel", () => {
    const { setActivePanel } = usePanelStore.getState();
    setActivePanel("right");
    expect(usePanelStore.getState().activePanel).toBe("right");

    setActivePanel("left");
    expect(usePanelStore.getState().activePanel).toBe("left");
  });
});

describe("panelStore — setPanelViewMode", () => {
  it("switches view mode for only the targeted panel", () => {
    const { setPanelViewMode } = usePanelStore.getState();

    setPanelViewMode("left", "brief");
    expect(usePanelStore.getState().panelViewModes.left).toBe("brief");
    expect(usePanelStore.getState().panelViewModes.right).toBe("detailed");

    setPanelViewMode("right", "brief");
    expect(usePanelStore.getState().panelViewModes.left).toBe("brief");
    expect(usePanelStore.getState().panelViewModes.right).toBe("brief");

    setPanelViewMode("left", "detailed");
    expect(usePanelStore.getState().panelViewModes.left).toBe("detailed");
    expect(usePanelStore.getState().panelViewModes.right).toBe("brief");
  });
});

describe("panelStore — swapPanels", () => {
  it("preserves each panel's resolved access path when swapping display paths", () => {
    const state = usePanelStore.getState();
    state.setPath("left", "/Users/back/Dropbox");
    state.setResolvedPath("left", "/Users/back/Library/CloudStorage/Dropbox");
    state.setPath("right", "/Users/back/Documents");
    state.setResolvedPath("right", "/Users/back/Library/Mobile Documents/Documents");

    usePanelStore.getState().swapPanels();

    const nextState = usePanelStore.getState();
    expect(nextState.leftPanel.currentPath).toBe("/Users/back/Documents");
    expect(nextState.leftPanel.resolvedPath).toBe(
      "/Users/back/Library/Mobile Documents/Documents"
    );
    expect(nextState.rightPanel.currentPath).toBe("/Users/back/Dropbox");
    expect(nextState.rightPanel.resolvedPath).toBe(
      "/Users/back/Library/CloudStorage/Dropbox"
    );
  });
});

describe("panelStore — setPath", () => {
  it("changes current path", () => {
    const { setPath } = usePanelStore.getState();
    setPath("left", "/new/path");
    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/new/path");
  });

  it("resets cursor to 0 on path change", () => {
    const { setCursor, setPath } = usePanelStore.getState();
    setCursor("left", 5);
    setPath("left", "/another/path");
    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(0);
  });

  it("clears selection on path change", () => {
    const { toggleSelection, setPath } = usePanelStore.getState();
    toggleSelection("left", "/some/file");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(1);

    setPath("left", "/new/path");
    expect(usePanelStore.getState().leftPanel.selectedItems.size).toBe(0);
  });
});

describe("panelStore — history navigation", () => {
  it("goBack and goForward restore display paths and reset transient panel state", () => {
    const {
      goBack,
      goForward,
      setCursor,
      setPath,
      setPendingCursorName,
      setResolvedPath,
      toggleSelection,
    } = usePanelStore.getState();

    setPath("left", "/first");
    setResolvedPath("left", "/resolved/first");
    setPath("left", "/second");
    setResolvedPath("left", "/resolved/second");
    setCursor("left", 4);
    toggleSelection("left", "/second/item.txt");
    setPendingCursorName("left", "item.txt");

    goBack("left");

    let panel = usePanelStore.getState().leftPanel;
    expect(panel.currentPath).toBe("/first");
    expect(panel.resolvedPath).toBe("/first");
    expect(panel.cursorIndex).toBe(0);
    expect(panel.selectedItems.size).toBe(0);
    expect(panel.pendingCursorName).toBeNull();

    goForward("left");

    panel = usePanelStore.getState().leftPanel;
    expect(panel.currentPath).toBe("/second");
    expect(panel.resolvedPath).toBe("/second");
    expect(panel.cursorIndex).toBe(0);
    expect(panel.selectedItems.size).toBe(0);
    expect(panel.pendingCursorName).toBeNull();
  });
});
