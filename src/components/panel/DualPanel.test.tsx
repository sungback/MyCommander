import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DualPanel } from "./DualPanel";
import { useSettingsStore } from "../../store/settingsStore";

const mockResize = vi.fn();
const panelProps: Array<Record<string, unknown>> = [];

vi.mock("react-resizable-panels", () => ({
  Group: ({
    children,
    onLayoutChanged,
  }: {
    children: React.ReactNode;
    onLayoutChanged?: (layout: Record<string, number>) => void;
  }) => (
    <div
      data-testid="panel-group"
      onClick={() => onLayoutChanged?.({ "left-panel": 60, "right-panel": 40 })}
    >
      {children}
    </div>
  ),
  Panel: React.forwardRef(function PanelMock(
    props: Record<string, unknown>,
    _ref: React.ForwardedRef<unknown>
  ) {
    panelProps.push(props);

    const panelRef = props.panelRef as
      | { current: { getSize: () => { asPercentage: number }; resize: (size: string) => void } | null }
      | undefined;

    if (panelRef) {
      panelRef.current = {
        getSize: () => ({ asPercentage: 50 }),
        resize: mockResize,
      };
    }

    return <div data-testid={String(props.id)}>{props.children as React.ReactNode}</div>;
  }),
  Separator: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./FilePanel", () => ({
  FilePanel: ({ id }: { id: string }) => <div data-testid={`file-panel-${id}`} />,
}));

describe("DualPanel", () => {
  beforeEach(() => {
    panelProps.length = 0;
    mockResize.mockReset();
    useSettingsStore.setState(useSettingsStore.getInitialState());
  });

  it("passes percentage sizes to panel defaults", () => {
    useSettingsStore.getState().setPanelLeftRatio(55);

    render(<DualPanel />);

    expect(panelProps[0]?.defaultSize).toBe("55%");
    expect(panelProps[1]?.defaultSize).toBe("45%");
  });

  it("resizes the left panel using percentage strings when settings change", async () => {
    render(<DualPanel />);

    await act(async () => {
      useSettingsStore.getState().setPanelLeftRatio(55);
    });

    await waitFor(() => {
      expect(mockResize).toHaveBeenCalledWith("55%");
    });
  });
});
