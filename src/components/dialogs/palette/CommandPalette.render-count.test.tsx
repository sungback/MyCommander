import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialogStore } from "../../../store/dialogStore";
import { usePanelStore } from "../../../store/panelStore";
import { CommandPalette } from "./CommandPalette";

vi.mock("../../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({}),
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const setLeftCursor = (cursorIndex: number) =>
  act(() => {
    usePanelStore.setState((state) => ({
      ...state,
      leftPanel: { ...state.leftPanel, cursorIndex },
    }));
  });

describe("CommandPalette render count", () => {
  it("does not re-render on cursor moves while closed", () => {
    useDialogStore.getState().closeDialog();
    let commits = 0;
    render(
      <Profiler id="palette" onRender={() => { commits += 1; }}>
        <CommandPalette />
      </Profiler>
    );
    const base = commits;

    for (let i = 1; i <= 5; i++) setLeftCursor(i);

    expect(commits).toBe(base);
  });
});
