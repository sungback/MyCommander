import { describe, it, expect, beforeEach } from "vitest";
import { useContextMenuStore } from "./contextMenuStore";

beforeEach(() => {
  useContextMenuStore.setState(useContextMenuStore.getInitialState());
});

describe("contextMenuStore — initial state", () => {
  it("starts closed", () => {
    const state = useContextMenuStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.panelId).toBeNull();
    expect(state.targetPath).toBeNull();
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });
});

describe("contextMenuStore — openContextMenu", () => {
  it("opens with all properties set", () => {
    useContextMenuStore.getState().openContextMenu({
      panelId: "left",
      targetPath: "/some/file.txt",
      x: 100,
      y: 200,
    });

    const state = useContextMenuStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.panelId).toBe("left");
    expect(state.targetPath).toBe("/some/file.txt");
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);
  });

  it("defaults targetPath to null when not provided", () => {
    useContextMenuStore.getState().openContextMenu({
      panelId: "right",
      x: 50,
      y: 75,
    });

    const state = useContextMenuStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.panelId).toBe("right");
    expect(state.targetPath).toBeNull();
  });
});

describe("contextMenuStore — closeContextMenu", () => {
  it("resets open state, panelId, and targetPath", () => {
    const { openContextMenu, closeContextMenu } =
      useContextMenuStore.getState();

    openContextMenu({
      panelId: "left",
      targetPath: "/file",
      x: 100,
      y: 200,
    });

    closeContextMenu();

    const state = useContextMenuStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.panelId).toBeNull();
    expect(state.targetPath).toBeNull();
  });
});
