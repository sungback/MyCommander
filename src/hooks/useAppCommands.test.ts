import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppCommands } from "./useAppCommands";
import { usePanelStore } from "../store/panelStore";

describe("useAppCommands — syncOtherPanelToCurrentPath", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
  });

  it("활성 패널 경로를 반대 패널에 복제한다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/source");
    usePanelStore.getState().setPath("right", "/target");
    usePanelStore.getState().setActivePanel("left");

    result.current.syncOtherPanelToCurrentPath();

    const state = usePanelStore.getState();
    expect(state.leftPanel.currentPath).toBe("/source");
    expect(state.rightPanel.currentPath).toBe("/source");
  });

  it("명시한 원본 패널 기준으로 반대 패널을 동기화한다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/left-source");
    usePanelStore.getState().setPath("right", "/right-source");
    usePanelStore.getState().setActivePanel("right");

    result.current.syncOtherPanelToCurrentPath("left");

    const state = usePanelStore.getState();
    expect(state.leftPanel.currentPath).toBe("/left-source");
    expect(state.rightPanel.currentPath).toBe("/left-source");
  });

  it("이미 같은 경로면 패널 상태를 다시 만들지 않는다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/shared");
    usePanelStore.getState().setPath("right", "/shared");

    const beforeRightPanel = usePanelStore.getState().rightPanel;

    result.current.syncOtherPanelToCurrentPath("left");

    expect(usePanelStore.getState().rightPanel).toBe(beforeRightPanel);
  });

  it("resolvedPath가 같으면 다시 동기화하지 않는다", () => {
    const { result } = renderHook(() => useAppCommands());

    usePanelStore.getState().setPath("left", "/Users/back/Dropbox");
    usePanelStore
      .getState()
      .setResolvedPath("left", "/Users/back/Library/CloudStorage/Dropbox");
    usePanelStore.getState().setPath("right", "/Users/back/Library/CloudStorage/Dropbox");

    const beforeRightPanel = usePanelStore.getState().rightPanel;

    result.current.syncOtherPanelToCurrentPath("left");

    expect(usePanelStore.getState().rightPanel).toBe(beforeRightPanel);
  });
});
