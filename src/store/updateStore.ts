import { create } from "zustand";
import { openUrl } from "@tauri-apps/plugin-opener";
import packageJson from "../../package.json";
import { fetchLatestRelease, UpdateInfo } from "../services/update/githubReleaseClient";
import { useDialogStore } from "./dialogStore";
import { showTransientToast } from "./toastStore";
import { getErrorMessage } from "../hooks/useFileSystem";

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
  checkForUpdates: (options?: CheckUpdateOptions) => Promise<void>;
  skipVersion: (version: string) => void;
  openDownloadUrl: () => Promise<void>;
  openReleasePage: () => Promise<void>;
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

    if (!silent) {
      showTransientToast("최신 버전을 확인하고 있습니다...", { tone: "info", durationMs: 2000 });
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
          showTransientToast(`현재 최신 버전(v${state.currentVersion})을 사용하고 있습니다.`, {
            tone: "success",
            durationMs: 2500,
          });
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "업데이트 정보를 가져오지 못했습니다.");
      if (!silent) {
        set({ status: "error", errorMessage: msg });
        showTransientToast(`업데이트 확인 실패: ${msg}`, { tone: "error", durationMs: 3500 });
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
    const url = updateInfo?.releaseUrl;
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

  reset: () => {
    set({
      status: "idle",
      updateInfo: null,
      errorMessage: null,
    });
  },
}));
