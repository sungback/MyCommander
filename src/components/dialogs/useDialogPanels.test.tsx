import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePanelStore } from "../../store/panelStore";
import { useDialogPanels } from "./useDialogPanels";

const initialState = usePanelStore.getState();

const setLeftCursor = (cursorIndex: number) =>
  act(() => {
    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: { ...state.leftPanel, cursorIndex },
    }));
  });

describe("useDialogPanels", () => {
  afterEach(() => {
    usePanelStore.setState(initialState, true);
  });

  it("does not re-render on panel changes while idle", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useDialogPanels(true);
    });
    const base = renders;

    for (let i = 1; i <= 5; i++) setLeftCursor(i);

    expect(renders).toBe(base);
  });

  it("re-renders on panel changes while a dialog is open", () => {
    const { result } = renderHook(() => useDialogPanels(false));

    setLeftCursor(3);

    expect(result.current.leftPanel.cursorIndex).toBe(3);
  });

  it("reads the latest panels when a dialog opens after idle changes", () => {
    const { result, rerender } = renderHook(
      ({ idle }) => useDialogPanels(idle),
      { initialProps: { idle: true } }
    );

    setLeftCursor(7);
    expect(result.current.leftPanel.cursorIndex).not.toBe(7);

    rerender({ idle: false });

    expect(result.current.leftPanel.cursorIndex).toBe(7);
  });
});
