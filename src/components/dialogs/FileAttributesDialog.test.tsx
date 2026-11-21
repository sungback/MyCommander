import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFileAttributes: vi.fn(),
  setFileAttributes: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => {
  // 실제 useFileSystem처럼 매번 같은 객체를 돌려준다.
  const fileSystem = {
    getFileAttributes: mocks.getFileAttributes,
    setFileAttributes: mocks.setFileAttributes,
  };
  return {
    useFileSystem: () => fileSystem,
    getErrorMessage: (error: unknown, fallback: string) =>
      error instanceof Error ? error.message : fallback,
  };
});
vi.mock("../../store/panelRefresh", () => ({ refreshPanelsForDirectories: mocks.refresh }));
vi.mock("../../store/toastStore", () => ({ showTransientToast: mocks.toast }));

import { useDialogStore } from "../../store/dialogStore";
import { FileAttributesDialog } from "./FileAttributesDialog";

// 2020-01-02 03:04:05.678 (로컬 시간)
const ORIGINAL_MS = new Date(2020, 0, 2, 3, 4, 5, 678).getTime();
const loaded = (overrides: Record<string, unknown> = {}) => ({
  modifiedMs: ORIGINAL_MS,
  readOnly: false,
  isDir: false,
  isSymlink: false,
  ...overrides,
});

const openDialog = async (attrs = loaded()) => {
  mocks.getFileAttributes.mockResolvedValue(attrs);
  render(<FileAttributesDialog />);
  act(() => useDialogStore.getState().openAttributesDialog({ panelId: "left", path: "/d/a.txt" }));
  await screen.findByLabelText("수정 시간 (로컬 시간)");
};

describe("FileAttributesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDialogStore.getState().closeDialog();
  });

  it("현재 속성을 읽어 입력창에 채운다", async () => {
    await openDialog(loaded({ readOnly: true }));
    expect(mocks.getFileAttributes).toHaveBeenCalledWith("/d/a.txt");
    // 브라우저마다 소수 초(.000)를 붙일 수 있어 초 단위까지만 비교한다.
    expect((screen.getByLabelText("수정 시간 (로컬 시간)") as HTMLInputElement).value).toMatch(
      /^2020-01-02T03:04:05(\.000)?$/
    );
    expect((screen.getByLabelText("읽기 전용") as HTMLInputElement).checked).toBe(true);
  });

  it("바꾼 값만 보내고 패널을 갱신한 뒤 닫는다", async () => {
    mocks.setFileAttributes.mockResolvedValue(loaded());
    await openDialog();

    fireEvent.change(screen.getByLabelText("수정 시간 (로컬 시간)"), {
      target: { value: "2021-05-06T07:08:09" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mocks.setFileAttributes).toHaveBeenCalledWith(
        "/d/a.txt",
        new Date(2021, 4, 6, 7, 8, 9).getTime(),
        null
      )
    );
    expect(mocks.refresh).toHaveBeenCalledWith(["/d"], "file-operation");
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("읽기 전용만 바꾸면 시간은 보내지 않는다", async () => {
    mocks.setFileAttributes.mockResolvedValue(loaded({ readOnly: true }));
    await openDialog();

    fireEvent.click(screen.getByLabelText("읽기 전용"));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(mocks.setFileAttributes).toHaveBeenCalledWith("/d/a.txt", null, true)
    );
  });

  it("바꾼 것이 없으면 호출하지 않고 닫는다(원래 값의 밀리초는 변경으로 보지 않는다)", async () => {
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(useDialogStore.getState().openDialog).toBeNull());
    expect(mocks.setFileAttributes).not.toHaveBeenCalled();
  });

  it("형식이 틀린 날짜는 입력창이 빈 값으로 바꾸므로 시간은 바꾸지 않고 닫는다", async () => {
    await openDialog();

    fireEvent.change(screen.getByLabelText("수정 시간 (로컬 시간)"), {
      target: { value: "2020-01-02" },
    });
    // datetime-local은 잘못된 값을 빈 값으로 만들고, 빈 입력은 "시간 변경 없음"으로 다룬다.
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(useDialogStore.getState().openDialog).toBeNull());
    expect(mocks.setFileAttributes).not.toHaveBeenCalled();
  });

  it("저장에 실패하면 오류를 보이고 대화상자를 유지한다", async () => {
    mocks.setFileAttributes.mockRejectedValue(new Error("Permission denied"));
    await openDialog();

    fireEvent.click(screen.getByLabelText("읽기 전용"));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("Permission denied")).toBeTruthy();
    expect(useDialogStore.getState().openDialog).toBe("attributes");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("심볼릭 링크는 안내하고 입력을 막는다", async () => {
    await openDialog(loaded({ isSymlink: true }));

    expect(screen.getByText("심볼릭 링크의 속성은 바꿀 수 없습니다.")).toBeTruthy();
    expect((screen.getByLabelText("읽기 전용") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("속성을 읽지 못하면 오류를 보인다", async () => {
    mocks.getFileAttributes.mockRejectedValue(new Error("No such file"));
    render(<FileAttributesDialog />);
    act(() => useDialogStore.getState().openAttributesDialog({ panelId: "left", path: "/d/a.txt" }));

    expect(await screen.findByText("No such file")).toBeTruthy();
  });
});
