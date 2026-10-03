import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogStore } from "./dialogStore";
import { useUpdateStore } from "./updateStore";
import * as releaseClient from "../services/update/githubReleaseClient";
import * as openerPlugin from "@tauri-apps/plugin-opener";
import { systemCommands } from "../hooks/tauriCommands/systemCommands";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

describe("updateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useDialogStore.getState().closeDialog();
    useUpdateStore.getState().reset();
    useUpdateStore.setState({
      lastCheckedAt: null,
      skippedVersion: null,
      status: "idle",
      updateInfo: null,
      errorMessage: null,
    });
  });

  it("checks for updates and opens dialog when newer version is found", async () => {
    vi.spyOn(releaseClient, "fetchLatestRelease").mockResolvedValue({
      version: "9.9.9",
      releaseName: "v9.9.9",
      releaseNotes: "Amazing update",
      publishedAt: "2026-10-03T12:00:00Z",
      releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v9.9.9",
      downloadUrl: "https://github.com/sungback/MyCommander/releases/download/v9.9.9/app.dmg",
      assetName: "app.dmg",
      selfUpdateUrl: "https://github.com/sungback/MyCommander/releases/download/v9.9.9/MyCommander_aarch64.app.tar.gz",
      selfUpdateAssetName: "MyCommander_aarch64.app.tar.gz",
      isNewer: true,
    });

    await useUpdateStore.getState().checkForUpdates();

    const state = useUpdateStore.getState();
    expect(state.status).toBe("available");
    expect(state.updateInfo?.version).toBe("9.9.9");
    expect(useDialogStore.getState().openDialog).toBe("update");
  });

  it("opens the dialog with latest status on manual check, but not on silent check", async () => {
    vi.spyOn(releaseClient, "fetchLatestRelease").mockResolvedValue({
      version: "1.0.0",
      releaseName: "v1.0.0",
      releaseNotes: "Old",
      publishedAt: "2026-01-01T00:00:00Z",
      releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v1.0.0",
      downloadUrl: null,
      assetName: null,
      selfUpdateUrl: null,
      selfUpdateAssetName: null,
      isNewer: false,
    });

    await useUpdateStore.getState().checkForUpdates({ force: true, silent: true });
    expect(useUpdateStore.getState().status).toBe("latest");
    expect(useDialogStore.getState().openDialog).toBeNull();

    await useUpdateStore.getState().checkForUpdates({ force: true });
    expect(useUpdateStore.getState().status).toBe("latest");
    expect(useDialogStore.getState().openDialog).toBe("update");
  });

  it("respects 24-hour cooldown for non-forced checks", async () => {
    const fetchSpy = vi.spyOn(releaseClient, "fetchLatestRelease");
    const recentCheck = Date.now() - 1000; // 1 second ago
    useUpdateStore.setState({ lastCheckedAt: recentCheck });

    await useUpdateStore.getState().checkForUpdates({ silent: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Forced check ignores cooldown
    await useUpdateStore.getState().checkForUpdates({ force: true });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("does not open dialog for skipped version unless forced", async () => {
    vi.spyOn(releaseClient, "fetchLatestRelease").mockResolvedValue({
      version: "2.0.0",
      releaseName: "v2.0.0",
      releaseNotes: "Notes",
      publishedAt: "2026-10-03T12:00:00Z",
      releaseUrl: "https://github.com/...",
      downloadUrl: "https://github.com/.../app.dmg",
      assetName: "app.dmg",
      selfUpdateUrl: "https://github.com/.../app.tar.gz",
      selfUpdateAssetName: "app.tar.gz",
      isNewer: true,
    });

    useUpdateStore.getState().skipVersion("2.0.0");
    expect(useUpdateStore.getState().skippedVersion).toBe("2.0.0");

    // Non-forced check: available status but no dialog
    await useUpdateStore.getState().checkForUpdates({ force: false, silent: true });
    expect(useUpdateStore.getState().status).toBe("available");
    expect(useDialogStore.getState().openDialog).toBeNull();

    // Forced check: dialog opens even if skipped
    await useUpdateStore.getState().checkForUpdates({ force: true });
    expect(useDialogStore.getState().openDialog).toBe("update");
  });

  it("handles errors gracefully in silent vs manual mode", async () => {
    vi.spyOn(releaseClient, "fetchLatestRelease").mockRejectedValue(
      new Error("Network failed")
    );

    // Silent check (e.g. at startup)
    await useUpdateStore.getState().checkForUpdates({ silent: true, force: true });
    expect(useUpdateStore.getState().status).toBe("idle");
    expect(useUpdateStore.getState().errorMessage).toBeNull();
    expect(useDialogStore.getState().openDialog).toBeNull();

    // Manual check
    await useUpdateStore.getState().checkForUpdates({ silent: false, force: true });
    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().errorMessage).toBe("Network failed");
    expect(useDialogStore.getState().openDialog).toBe("update");
  });

  it("opens download URL and release page using opener plugin", async () => {
    useUpdateStore.setState({
      updateInfo: {
        version: "2.0.0",
        releaseName: "v2.0.0",
        releaseNotes: "Notes",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/sungback/MyCommander/releases/tag/v2.0.0",
        downloadUrl: "https://github.com/sungback/MyCommander/releases/download/v2.0.0/app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: "https://github.com/sungback/MyCommander/releases/download/v2.0.0/app.tar.gz",
        selfUpdateAssetName: "app.tar.gz",
        isNewer: true,
      },
    });

    await useUpdateStore.getState().openDownloadUrl();
    expect(openerPlugin.openUrl).toHaveBeenCalledWith(
      "https://github.com/sungback/MyCommander/releases/download/v2.0.0/app.dmg"
    );

    await useUpdateStore.getState().openReleasePage();
    expect(openerPlugin.openUrl).toHaveBeenCalledWith(
      "https://github.com/sungback/MyCommander/releases/tag/v2.0.0"
    );
  });

  it("applies self-update successfully", async () => {
    const applySpy = vi.spyOn(systemCommands, "applySelfUpdate").mockResolvedValue(undefined);
    useUpdateStore.setState({
      updateInfo: {
        version: "2.0.0",
        releaseName: "v2.0.0",
        releaseNotes: "Notes",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/...",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: "https://github.com/.../MyCommander_aarch64.app.tar.gz",
        selfUpdateAssetName: "MyCommander_aarch64.app.tar.gz",
        isNewer: true,
      },
    });

    await useUpdateStore.getState().applySelfUpdate();
    expect(applySpy).toHaveBeenCalledWith("https://github.com/.../MyCommander_aarch64.app.tar.gz");
    expect(useUpdateStore.getState().updateStep).toBe("재시작 중...");
  });

  it("handles self-update failure gracefully", async () => {
    vi.spyOn(systemCommands, "applySelfUpdate").mockRejectedValue(new Error("다운로드 실패"));
    useUpdateStore.setState({
      updateInfo: {
        version: "2.0.0",
        releaseName: "v2.0.0",
        releaseNotes: "Notes",
        publishedAt: "2026-10-03T12:00:00Z",
        releaseUrl: "https://github.com/...",
        downloadUrl: "https://github.com/.../app.dmg",
        assetName: "app.dmg",
        selfUpdateUrl: "https://github.com/.../MyCommander_aarch64.app.tar.gz",
        selfUpdateAssetName: "MyCommander_aarch64.app.tar.gz",
        isNewer: true,
      },
    });

    await useUpdateStore.getState().applySelfUpdate();
    expect(useUpdateStore.getState().isUpdating).toBe(false);
    expect(useUpdateStore.getState().errorMessage).toBe("다운로드 실패");
  });
});
