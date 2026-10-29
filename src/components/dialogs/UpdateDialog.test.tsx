import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogStore } from "../../store/dialogStore";
import { useUpdateStore } from "../../store/updateStore";
import { UpdateDialog } from "./UpdateDialog";

describe("UpdateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDialogStore.getState().closeDialog();
    useUpdateStore.setState({
      currentVersion: "1.2.25",
      status: "available",
      updateInfo: {
        version: "1.3.0",
        releaseName: "v1.3.0",
        releaseNotes: "Feature 1\nFeature 2",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v1.3.0",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: null,
        selfUpdateAssetName: null,
        isNewer: true,
      },
      skippedVersion: null,
      isUpdating: false,
      updateStep: null,
      errorMessage: null,
    });
  });

  it("does not render when dialog is not 'update'", () => {
    useDialogStore.getState().setOpenDialog(null);
    const { container } = render(<UpdateDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("renders release information when openDialog is 'update'", () => {
    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    expect(screen.getByText("새로운 버전이 출시되었습니다")).toBeInTheDocument();
    expect(screen.getByText("v1.2.25")).toBeInTheDocument();
    expect(screen.getByText("v1.3.0")).toBeInTheDocument();
    expect(screen.getByText("app.dmg")).toBeInTheDocument();
  });

  it("handles download button click when selfUpdateUrl is not available", async () => {
    const downloadSpy = vi.fn().mockResolvedValue(undefined);
    useUpdateStore.setState({
      openDownloadUrl: downloadSpy,
      updateInfo: {
        version: "1.3.0",
        releaseName: "v1.3.0",
        releaseNotes: "Feature 1\nFeature 2",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v1.3.0",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: null,
        selfUpdateAssetName: null,
        isNewer: true,
      },
    });

    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    const downloadBtn = screen.getByRole("button", { name: /지금 다운로드/i });
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(downloadSpy).toHaveBeenCalled();
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("handles self-update button click when selfUpdateUrl is available", async () => {
    const applySpy = vi.fn().mockResolvedValue(undefined);
    useUpdateStore.setState({
      applySelfUpdate: applySpy,
      updateInfo: {
        version: "1.3.0",
        releaseName: "v1.3.0",
        releaseNotes: "Feature 1\nFeature 2",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v1.3.0",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: "https://github.com/.../MyCommander_aarch64.app.tar.gz",
        selfUpdateAssetName: "MyCommander_aarch64.app.tar.gz",
        isNewer: true,
      },
    });

    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    const updateBtn = screen.getByRole("button", { name: /지금 업데이트 및 재시작/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    expect(applySpy).toHaveBeenCalled();
  });

  it("disables buttons and shows spinner when isUpdating is true", () => {
    useUpdateStore.setState({
      isUpdating: true,
      updateStep: "다운로드 및 설치 중...",
      updateInfo: {
        version: "1.3.0",
        releaseName: "v1.3.0",
        releaseNotes: "Feature 1\nFeature 2",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v1.3.0",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: "https://github.com/.../MyCommander_aarch64.app.tar.gz",
        selfUpdateAssetName: "MyCommander_aarch64.app.tar.gz",
        isNewer: true,
      },
    });

    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    const updateBtn = screen.getByRole("button", { name: /다운로드 및 설치 중\.\.\./i });
    expect(updateBtn).toBeDisabled();

    const laterBtn = screen.getByRole("button", { name: /나중에/i });
    expect(laterBtn).toBeDisabled();
  });

  it("saves skipped version when checkbox is checked on close", () => {
    const skipSpy = vi.fn();
    useUpdateStore.setState({ skipVersion: skipSpy });

    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    const checkbox = screen.getByLabelText(/이 버전\(v1.3.0\) 알림 건너뛰기/i);
    fireEvent.click(checkbox);

    const laterBtn = screen.getByRole("button", { name: /나중에/i });
    fireEvent.click(laterBtn);

    expect(skipSpy).toHaveBeenCalledWith("1.3.0");
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("shows the latest-version message when status is latest", () => {
    useUpdateStore.setState({ status: "latest" });
    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    expect(screen.getByText("최신 버전입니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(useDialogStore.getState().openDialog).toBeNull();
  });

  it("shows the error message when status is error", () => {
    useUpdateStore.setState({ status: "error", errorMessage: "Load failed", updateInfo: null });
    useDialogStore.getState().setOpenDialog("update");
    render(<UpdateDialog />);

    expect(screen.getByText("업데이트 확인 실패")).toBeInTheDocument();
    expect(screen.getByText("Load failed")).toBeInTheDocument();
  });
});
