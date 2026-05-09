import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  runSamePanelDropAction,
  runCrossPanelDropAction,
} from "./fileListDragDropActions";

const mockShowTransientToast = vi.hoisted(() => vi.fn());
vi.mock("../../store/toastStore", () => ({
  showTransientToast: mockShowTransientToast,
}));

const PATHS = ["/a/file.txt"];
const TARGET_PATH = "/target/dir";

beforeEach(() => {
  mockShowTransientToast.mockClear();
});

describe("runSamePanelDropAction", () => {
  it("blocked intent with blockedReason → toast with that reason + warning tone; no handlers called", () => {
    const handleDraggedCopy = vi.fn();
    const handleDraggedMove = vi.fn();

    runSamePanelDropAction({
      paths: PATHS,
      panelId: "left",
      intent: {
        isDropAllowed: false,
        blockedReason: "some reason",
        isFolderOnlyMove: false,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy,
      handleDraggedMove,
    });

    expect(mockShowTransientToast).toHaveBeenCalledWith("some reason", {
      durationMs: 1800,
      tone: "warning",
    });
    expect(handleDraggedCopy).not.toHaveBeenCalled();
    expect(handleDraggedMove).not.toHaveBeenCalled();
  });

  it("blocked intent without blockedReason → toast with default message", () => {
    runSamePanelDropAction({
      paths: PATHS,
      panelId: "left",
      intent: {
        isDropAllowed: false,
        blockedReason: null,
        isFolderOnlyMove: false,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy: vi.fn(),
      handleDraggedMove: vi.fn(),
    });

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "여기로는 복사할 수 없습니다.",
      { durationMs: 1800, tone: "warning" }
    );
  });

  it("allowed + isFolderOnlyMove true → calls handleDraggedMove, not handleDraggedCopy", () => {
    const handleDraggedCopy = vi.fn();
    const handleDraggedMove = vi.fn().mockResolvedValue(undefined);

    runSamePanelDropAction({
      paths: PATHS,
      panelId: "left",
      intent: {
        isDropAllowed: true,
        blockedReason: null,
        isFolderOnlyMove: true,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy,
      handleDraggedMove,
    });

    expect(handleDraggedMove).toHaveBeenCalledWith(PATHS, TARGET_PATH);
    expect(handleDraggedCopy).not.toHaveBeenCalled();
  });

  it("allowed + isFolderOnlyMove false → calls handleDraggedCopy with panelId", () => {
    const handleDraggedCopy = vi.fn().mockResolvedValue(undefined);
    const handleDraggedMove = vi.fn();

    runSamePanelDropAction({
      paths: PATHS,
      panelId: "right",
      intent: {
        isDropAllowed: true,
        blockedReason: null,
        isFolderOnlyMove: false,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy,
      handleDraggedMove,
    });

    expect(handleDraggedCopy).toHaveBeenCalledWith(PATHS, TARGET_PATH, "right");
    expect(handleDraggedMove).not.toHaveBeenCalled();
  });

  it("handleDraggedMove rejects → toast with move error message + error tone", async () => {
    const handleDraggedMove = vi.fn().mockRejectedValue(new Error("move fail"));

    runSamePanelDropAction({
      paths: PATHS,
      panelId: "left",
      intent: {
        isDropAllowed: true,
        blockedReason: null,
        isFolderOnlyMove: true,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy: vi.fn(),
      handleDraggedMove,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "폴더를 이동하지 못했습니다.",
      { durationMs: 1800, tone: "error" }
    );
  });

  it("handleDraggedCopy rejects → toast with copy error message + error tone", async () => {
    const handleDraggedCopy = vi.fn().mockRejectedValue(new Error("copy fail"));

    runSamePanelDropAction({
      paths: PATHS,
      panelId: "left",
      intent: {
        isDropAllowed: true,
        blockedReason: null,
        isFolderOnlyMove: false,
        targetPath: TARGET_PATH,
      },
      handleDraggedCopy,
      handleDraggedMove: vi.fn(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "파일을 복사하지 못했습니다.",
      { durationMs: 1800, tone: "error" }
    );
  });
});

describe("runCrossPanelDropAction", () => {
  it("blockedReason present → toast + returns 'blocked'", () => {
    const handleDraggedCopy = vi.fn();

    const result = runCrossPanelDropAction({
      paths: PATHS,
      intent: {
        blockedReason: "cross blocked",
        targetPath: TARGET_PATH,
        targetPanel: "right",
      },
      handleDraggedCopy,
    });

    expect(result).toBe("blocked");
    expect(mockShowTransientToast).toHaveBeenCalledWith("cross blocked", {
      durationMs: 1800,
      tone: "warning",
    });
    expect(handleDraggedCopy).not.toHaveBeenCalled();
  });

  it("no blockedReason → calls handleDraggedCopy + returns 'submitted'", () => {
    const handleDraggedCopy = vi.fn().mockResolvedValue(undefined);

    const result = runCrossPanelDropAction({
      paths: PATHS,
      intent: {
        blockedReason: null,
        targetPath: TARGET_PATH,
        targetPanel: "right",
      },
      handleDraggedCopy,
    });

    expect(result).toBe("submitted");
    expect(handleDraggedCopy).toHaveBeenCalledWith(PATHS, TARGET_PATH, "right");
  });

  it("handleDraggedCopy rejects → toast with copy error message (fire-and-forget)", async () => {
    const handleDraggedCopy = vi
      .fn()
      .mockRejectedValue(new Error("cross copy fail"));

    runCrossPanelDropAction({
      paths: PATHS,
      intent: {
        blockedReason: null,
        targetPath: TARGET_PATH,
        targetPanel: "left",
      },
      handleDraggedCopy,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockShowTransientToast).toHaveBeenCalledWith(
      "파일을 복사하지 못했습니다.",
      { durationMs: 1800, tone: "error" }
    );
  });
});
