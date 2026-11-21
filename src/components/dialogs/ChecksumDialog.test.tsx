import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types/file";

const mocks = vi.hoisted(() => ({
  computeChecksums: vi.fn(),
  verifyChecksumFile: vi.fn(),
  cancelChecksum: vi.fn(),
  onChecksumProgress: vi.fn(),
  progressHandler: null as null | ((progress: unknown) => void),
  panel: {} as Record<string, unknown>,
  save: vi.fn(),
  open: vi.fn(),
  writeTextFile: vi.fn(),
  writeClipboardText: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => {
  // 실제 useFileSystem처럼 매번 같은 객체를 돌려준다. 새 객체를 주면 진행 구독이 렌더마다 다시 걸린다.
  const fileSystem = {
    computeChecksums: mocks.computeChecksums,
    verifyChecksumFile: mocks.verifyChecksumFile,
    cancelChecksum: mocks.cancelChecksum,
    onChecksumProgress: mocks.onChecksumProgress,
  };
  return {
    useFileSystem: () => fileSystem,
    getErrorMessage: (error: unknown, fallback: string) =>
      typeof error === "string" ? error : fallback,
  };
});
vi.mock("../../store/panelStore", () => ({
  usePanelStore: { getState: () => mocks.panel },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open, save: mocks.save }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: mocks.writeTextFile }));
vi.mock("../../utils/clipboard", () => ({ writeClipboardText: mocks.writeClipboardText }));

import { useDialogStore } from "../../store/dialogStore";
import { ChecksumDialog } from "./ChecksumDialog";

const file = (name: string, kind: FileEntry["kind"] = "file"): FileEntry => ({
  name,
  path: `/d/${name}`,
  kind,
  size: 1,
});

const setPanel = (files: FileEntry[], selected: string[], cursorIndex = 0) => {
  mocks.panel = {
    activePanel: "left",
    leftPanel: { files, selectedItems: new Set(selected), cursorIndex },
    rightPanel: { files: [], selectedItems: new Set(), cursorIndex: 0 },
  };
};

describe("ChecksumDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDialogStore.getState().closeDialog();
    mocks.progressHandler = null;
    mocks.onChecksumProgress.mockImplementation(async (handler: (progress: unknown) => void) => {
      mocks.progressHandler = handler;
      return () => {
        mocks.progressHandler = null;
      };
    });
  });

  it("shows progress of the running job and ignores other jobs", async () => {
    setPanel([file("big.bin")], ["/d/big.bin"]);
    let finish: (value: unknown[]) => void = () => undefined;
    mocks.computeChecksums.mockImplementation(
      () => new Promise((resolve) => (finish = resolve as typeof finish))
    );
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("generate"));
    await screen.findByText("파일 1개");
    await waitFor(() => expect(mocks.progressHandler).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "계산" }));
    await waitFor(() => expect(mocks.computeChecksums).toHaveBeenCalled());
    const jobId = mocks.computeChecksums.mock.calls[0][2] as string;

    act(() =>
      mocks.progressHandler?.({
        jobId: "other-job",
        fileIndex: 1,
        fileCount: 1,
        fileName: "other.bin",
        bytesDone: 10,
        bytesTotal: 10,
      })
    );
    expect(screen.queryByText(/other\.bin/)).toBeNull();

    act(() =>
      mocks.progressHandler?.({
        jobId,
        fileIndex: 1,
        fileCount: 3,
        fileName: "big.bin",
        bytesDone: 50,
        bytesTotal: 200,
      })
    );
    expect(await screen.findByText(/파일 1\/3 · big\.bin · 25%/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");

    await act(async () => finish([]));
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  });

  it("generates checksums for selected files only (folders excluded) and shows results", async () => {
    setPanel([file("a.bin"), file("dir", "directory")], ["/d/a.bin", "/d/dir"]);
    mocks.computeChecksums.mockResolvedValue([
      {
        path: "/d/a.bin",
        name: "a.bin",
        hashes: [{ algorithm: "sha256", value: "abc123" }],
        error: null,
      },
    ]);
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("generate"));

    expect(await screen.findByText("파일 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "계산" }));

    expect(await screen.findByText(/SHA256: abc123/)).toBeTruthy();
    expect(mocks.computeChecksums).toHaveBeenCalledWith(
      ["/d/a.bin"],
      ["sha256"],
      expect.stringMatching(/^checksum-/)
    );
  });

  it("shows an error when no file is selected", async () => {
    setPanel([file("dir", "directory")], ["/d/dir"]);
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("generate"));
    expect(await screen.findByText(/계산할 파일이 없습니다/)).toBeTruthy();
    expect(mocks.computeChecksums).not.toHaveBeenCalled();
  });

  it("cancels the running job when the dialog is dismissed", async () => {
    setPanel([file("a.bin")], ["/d/a.bin"]);
    mocks.computeChecksums.mockReturnValue(new Promise(() => {}));
    mocks.cancelChecksum.mockResolvedValue(undefined);
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("generate"));
    fireEvent.click(await screen.findByRole("button", { name: "계산" }));
    await waitFor(() => expect(mocks.computeChecksums).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(mocks.cancelChecksum).toHaveBeenCalledWith(mocks.computeChecksums.mock.calls[0][2])
    );
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("verify mode uses the cursor checksum file without opening a picker", async () => {
    setPanel([file("sums.sha256")], [], 0);
    mocks.verifyChecksumFile.mockResolvedValue([
      {
        name: "a.bin",
        path: "/d/a.bin",
        algorithm: "sha256",
        expected: "x",
        actual: "x",
        status: "ok",
        error: null,
      },
      {
        name: "b.bin",
        path: "/d/b.bin",
        algorithm: "sha256",
        expected: "x",
        actual: "y",
        status: "mismatch",
        error: null,
      },
    ]);
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("verify"));

    expect(await screen.findByText(/일치 1 · 불일치 1/)).toBeTruthy();
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.verifyChecksumFile).toHaveBeenCalledWith(
      "/d/sums.sha256",
      expect.stringMatching(/^checksum-/)
    );
  });

  it("verify mode opens a picker otherwise and closes if it is dismissed", async () => {
    setPanel([file("a.bin")], [], 0);
    mocks.open.mockResolvedValue(null);
    render(<ChecksumDialog />);
    act(() => useDialogStore.getState().openChecksumDialog("verify"));
    await waitFor(() => expect(mocks.open).toHaveBeenCalled());
    await waitFor(() => expect(useDialogStore.getState().openDialog).toBeNull());
    expect(mocks.verifyChecksumFile).not.toHaveBeenCalled();
  });
});
