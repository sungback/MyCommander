import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MultiRenameDialog } from "./MultiRenameDialog";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";

const { mockApplyBatchRename } = vi.hoisted(() => ({
  mockApplyBatchRename: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useFileSystem")>(
    "../../hooks/useFileSystem"
  );

  return {
    ...actual,
    useFileSystem: () => ({
      applyBatchRename: mockApplyBatchRename,
    }),
  };
});

const openDialogWithSingleFile = () => {
  useDialogStore.getState().openMultiRenameDialog({
    panelId: "left",
    directoryPath: "/work",
    siblingNames: ["alpha.txt"],
    items: [
      {
        path: "/work/alpha.txt",
        name: "alpha.txt",
        kind: "file",
      },
    ],
  });
};

describe("MultiRenameDialog", () => {
  beforeEach(() => {
    useDialogStore.setState(useDialogStore.getInitialState());
    usePanelStore.setState(usePanelStore.getInitialState());
    mockApplyBatchRename.mockReset();
  });

  it("submits changed preview operations and closes the dialog", async () => {
    mockApplyBatchRename.mockResolvedValue(undefined);
    openDialogWithSingleFile();

    render(<MultiRenameDialog />);

    fireEvent.change(screen.getByLabelText("이름 마스크"), {
      target: { value: "photo_[C]" },
    });
    fireEvent.change(screen.getByLabelText("확장자 마스크"), {
      target: { value: "jpg" },
    });

    expect(screen.getByText("photo_1.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이름 변경 1개" }));

    await waitFor(() => {
      expect(mockApplyBatchRename).toHaveBeenCalledWith([
        {
          oldPath: "/work/alpha.txt",
          newPath: "/work/photo_1.jpg",
        },
      ]);
    });
    await waitFor(() => {
      expect(useDialogStore.getState().openDialog).toBeNull();
    });
  });
});
