import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshPanelsForDirectories, refreshPanelsForEntryPaths } from "./panelRefresh";
import { usePanelStore } from "./panelStore";

beforeEach(() => {
  usePanelStore.setState(usePanelStore.getInitialState());
});

describe("panelRefresh", () => {
  it("refreshes both panels when they point to the same directory", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(123456);

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/shared/");

    refreshPanelsForDirectories(["/shared"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(123456);
    expect(usePanelStore.getState().rightPanel.lastUpdated).toBe(123456);

    nowSpy.mockRestore();
  });

  it("refreshes only panels viewing affected directories", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(555);

    usePanelStore.getState().setPath("left", "/left");
    usePanelStore.getState().setPath("right", "/right");

    const rightBefore = usePanelStore.getState().rightPanel.lastUpdated;

    refreshPanelsForDirectories(["/left"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(555);
    expect(usePanelStore.getState().rightPanel.lastUpdated).toBe(rightBefore);

    nowSpy.mockRestore();
  });

  it("refreshes panels based on entry parent directories", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(999);

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/other");

    refreshPanelsForEntryPaths(["/shared/file.txt"]);

    expect(usePanelStore.getState().leftPanel.lastUpdated).toBe(999);
    expect(usePanelStore.getState().rightPanel.lastUpdated).not.toBe(999);

    nowSpy.mockRestore();
  });
});
