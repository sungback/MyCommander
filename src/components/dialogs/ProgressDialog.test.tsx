import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressDialog } from "./ProgressDialog";
import { useDialogStore } from "../../store/dialogStore";

const { listenHandlers, mockCancelZipOperation } = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
  mockCancelZipOperation: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    listenHandlers.set(eventName, handler);
    return () => {
      listenHandlers.delete(eventName);
    };
  }),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    cancelZipOperation: mockCancelZipOperation,
  }),
}));

describe("ProgressDialog", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    listenHandlers.clear();
    mockCancelZipOperation.mockReset();
  });

  it("shows delete progress details", async () => {
    useDialogStore.getState().setOpenDialog("progress");

    render(<ProgressDialog />);

    await Promise.resolve();

    act(() => {
      listenHandlers.get("fs-progress")?.({
        payload: {
          operation: "delete",
          current: 1,
          total: 4,
          currentFile: "LargeFolder",
          unit: "items",
        },
      });
    });

    expect(screen.getByText("Deleting Files...")).toBeInTheDocument();
    expect(screen.getByText("LargeFolder")).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
