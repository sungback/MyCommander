import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransferSpaceWarningStore } from "../../../store/transferSpaceWarningStore";
import { useFileListDragActions } from "./useFileListDragActions";

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    checkCopyConflicts: vi.fn(),
    checkTransferSpace: vi.fn(),
    submitJob: vi.fn(),
  },
}));

vi.mock("../../../hooks/useFileSystem", () => ({
  useFileSystem: () => mockFs,
}));

vi.mock("../../../store/toastStore", () => ({
  showTransientToast: vi.fn(),
}));

const answerWarning = async (proceed: boolean) => {
  await vi.waitFor(() => {
    expect(useTransferSpaceWarningStore.getState().pending).not.toBeNull();
  });
  act(() => {
    useTransferSpaceWarningStore.getState().respond(proceed);
  });
};

describe("useFileListDragActions — 공간 부족 경고", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransferSpaceWarningStore.setState({ pending: null });
    mockFs.checkCopyConflicts.mockResolvedValue([]);
    mockFs.submitJob.mockResolvedValue({ id: "job-1" });
    mockFs.checkTransferSpace.mockResolvedValue({
      requiredBytes: 5_000,
      availableBytes: 1_000,
      complete: true,
      insufficient: true,
    });
  });

  it("드래그 복사에서 경고를 취소하면 job을 제출하지 않는다", async () => {
    const { result } = renderHook(() => useFileListDragActions("left"));
    const copied = result.current.handleDraggedCopy(["/src/a"], "/dst", "right");
    await answerWarning(false);

    await expect(copied).resolves.toBe(false);
    expect(mockFs.checkTransferSpace).toHaveBeenCalledWith(["/src/a"], "/dst", false);
    expect(mockFs.submitJob).not.toHaveBeenCalled();
  });

  it("드래그 이동에서 경고 후 계속하면 이동 job을 제출한다", async () => {
    const { result } = renderHook(() => useFileListDragActions("left"));
    const moved = result.current.handleDraggedMove(["/src/a"], "/dst");
    await answerWarning(true);

    await expect(moved).resolves.toBe(true);
    expect(mockFs.checkTransferSpace).toHaveBeenCalledWith(["/src/a"], "/dst", true);
    expect(mockFs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "move", sourcePaths: ["/src/a"], targetDir: "/dst" })
    );
  });
});
