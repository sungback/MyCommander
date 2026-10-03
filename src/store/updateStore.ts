import { create } from "zustand";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageJson from "../../package.json";
import { fetchLatestRelease, UpdateInfo } from "../services/update/githubReleaseClient";
import { useDialogStore } from "./dialogStore";
import { getErrorMessage } from "../hooks/useFileSystem";
import { systemCommands } from "../hooks/tauriCommands/systemCommands";

export const STORAGE_KEY_LAST_CHECK = "mycommander-last-update-check";
export const STORAGE_KEY_SKIPPED_VERSION = "mycommander-skipped-version";
export const CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export type UpdateCheckStatus =
  | "idle"
  | "checking"
  | "available"
  | "latest"
  | "error";

export interface CheckUpdateOptions {
  force?: boolean;
  silent?: boolean;
}

export interface UpdateState {
  currentVersion: string;
  status: UpdateCheckStatus;
  updateInfo: UpdateInfo | null;
  errorMessage: string | null;
  lastCheckedAt: number | null;
  skippedVersion: string | null;
  isUpdating: boolean;
  updateStep: string | null;
  checkForUpdates: (options?: CheckUpdateOptions) => Promise<void>;
  skipVersion: (version: string) => void;
  openDownloadUrl: () => Promise<void>;
  openReleasePage: () => Promise<void>;
  applySelfUpdate: () => Promise<void>;
  reset: () => void;
}

const getInitialSkippedVersion = (): string | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
};

const getInitialLastCheck = (): number | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_LAST_CHECK);
  const parsed = raw ? parseInt(raw, 10) : null;
  return parsed && !isNaN(parsed) ? parsed : null;
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: packageJson.version,
  status: "idle",
  updateInfo: null,
  errorMessage: null,
  lastCheckedAt: getInitialLastCheck(),
  skippedVersion: getInitialSkippedVersion(),
  isUpdating: false,
  updateStep: null,

  checkForUpdates: async (options?: CheckUpdateOptions) => {
    const { force = false, silent = false } = options || {};
    const state = get();

    // Respect 24-hour cooldown for silent background checks
    if (!force && state.lastCheckedAt) {
      const elapsed = Date.now() - state.lastCheckedAt;
      if (elapsed < CHECK_COOLDOWN_MS) {
        return;
      }
    }

    set({ status: "checking", errorMessage: null });

    try {
      const updateInfo = await fetchLatestRelease(state.currentVersion);
      const now = Date.now();

      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_LAST_CHECK, now.toString());
      }

      if (updateInfo.isNewer) {
        // If this version was previously skipped by user and this check is non-forced/silent, skip dialog
        const isSkipped = state.skippedVersion === updateInfo.version;
        set({
          status: "available",
          updateInfo,
          lastCheckedAt: now,
          errorMessage: null,
        });

        if (!isSkipped || force) {
          useDialogStore.getState().setOpenDialog("update");
        }
      } else {
        set({
          status: "latest",
          updateInfo,
          lastCheckedAt: now,
          errorMessage: null,
        });

        if (!silent) {
          useDialogStore.getState().setOpenDialog("update");
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "업데이트 정보를 가져오지 못했습니다.");
      if (!silent) {
        set({ status: "error", errorMessage: msg });
        useDialogStore.getState().setOpenDialog("update");
      } else {
        // In silent mode, restore idle so user is not bothered
        set({ status: "idle" });
      }
    }
  },

  skipVersion: (version: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, version);
    }
    set({ skippedVersion: version });
  },

  openDownloadUrl: async () => {
    const { updateInfo } = get();
    const url = updateInfo?.downloadUrl || updateInfo?.releaseUrl;
    if (url) {
      try {
        await openUrl(url);
      } catch {
        if (typeof window !== "undefined") {
          window.open(url, "_blank");
        }
      }
    }
  },

  openReleasePage: async () => {
    const { updateInfo } = get();
    const url =
      updateInfo?.releaseUrl ?? "https://github.com/sungback/MyCommander/releases";
    if (url) {
      try {
        await openUrl(url);
      } catch {
        if (typeof window !== "undefined") {
          window.open(url, "_blank");
        }
      }
    }
  },

  applySelfUpdate: async () => {
    const { updateInfo } = get();
    if (!updateInfo?.selfUpdateUrl) {
      set({
        errorMessage: "자동 업데이트 가능한 파일이 없습니다. 릴리즈 페이지에서 다운로드해 주세요.",
      });
      return;
    }

    set({
      isUpdating: true,
      updateStep: "다운로드 및 설치 중...",
      errorMessage: null,
    });

    try {
      await systemCommands.applySelfUpdate(updateInfo.selfUpdateUrl);
      set({ updateStep: "재시작 중..." });
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "업데이트 적용에 실패했습니다.");
      set({ isUpdating: false, updateStep: null, errorMessage: msg });
    }
  },

  reset: () => {
    set({
      status: "idle",
      updateInfo: null,
      errorMessage: null,
      isUpdating: false,
      updateStep: null,
    });
  },
}));
