import { DependencyList, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { buildMultiRenameSession } from "../features/multiRename";
import { useDialogStore } from "../store/dialogStore";
import { usePanelStore } from "../store/panelStore";
import { ViewMode } from "../types/file";
import { ThemePreference } from "../types/theme";
import {
  getNextThemeTransitionDelay,
  resolveTheme,
} from "../utils/appTheme";

type PanelId = "left" | "right";
type Unlisten = () => void;

interface PanelViewModeChangedPayload {
  panel: PanelId;
  viewMode: ViewMode;
}

interface AppCommandListenerOptions {
  openMultiRenameDialog: ReturnType<typeof useDialogStore.getState>["openMultiRenameDialog"];
  setOpenDialog: ReturnType<typeof useDialogStore.getState>["setOpenDialog"];
  syncOtherPanelToCurrentPath: () => void;
}

interface NativeMenuSyncFileSystem {
  setShowHiddenMenuChecked: (checked: boolean) => Promise<void>;
  setThemeMenuSelection: (themePreference: ThemePreference) => Promise<void>;
  setViewModeMenuSelection: (leftMode: ViewMode, rightMode: ViewMode) => Promise<void>;
}

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "auto" || value === "light" || value === "dark";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPanelViewModeChangedPayload = (
  payload: unknown
): payload is PanelViewModeChangedPayload =>
  isRecord(payload) &&
  (payload.panel === "left" || payload.panel === "right") &&
  (payload.viewMode === "brief" || payload.viewMode === "detailed");

const useTauriSignal = (
  eventName: string,
  handleEvent: () => void,
  dependencies: DependencyList
) => {
  useEffect(() => {
    let isMounted = true;
    let cleanup: Unlisten | undefined;

    void listen(eventName, () => {
      if (isMounted) {
        handleEvent();
      }
    }).then((unlisten) => {
      if (!isMounted) {
        unlisten();
        return;
      }

      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, dependencies);
};

const useTauriEvent = <T,>(
  eventName: string,
  handlePayload: (payload: T) => void,
  dependencies: DependencyList
) => {
  useEffect(() => {
    let isMounted = true;
    let cleanup: Unlisten | undefined;

    void listen<T>(eventName, (event) => {
      if (isMounted) {
        handlePayload(event.payload);
      }
    }).then((unlisten) => {
      if (!isMounted) {
        unlisten();
        return;
      }

      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, dependencies);
};

export const usePanelFocusShortcut = (
  activePanelId: PanelId,
  setActivePanel: (panelId: PanelId) => void
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        setActivePanel(activePanelId === "left" ? "right" : "left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanelId, setActivePanel]);
};

export const useNativePreferenceListeners = (
  setShowHiddenFiles: (showHiddenFiles: boolean) => void,
  setThemePreference: (themePreference: ThemePreference) => void,
  setPanelViewMode: (panelId: PanelId, viewMode: ViewMode) => void
) => {
  useTauriEvent<boolean>(
    "show-hidden-files-changed",
    (payload) => setShowHiddenFiles(Boolean(payload)),
    [setShowHiddenFiles]
  );

  useTauriEvent<ThemePreference>(
    "theme-preference-changed",
    (payload) => {
      if (isThemePreference(payload)) {
        setThemePreference(payload);
      }
    },
    [setThemePreference]
  );

  useTauriEvent<PanelViewModeChangedPayload>(
    "panel-view-mode-changed",
    (payload) => {
      if (isPanelViewModeChangedPayload(payload)) {
        setPanelViewMode(payload.panel, payload.viewMode);
      }
    },
    [setPanelViewMode]
  );
};

export const useAppCommandListeners = ({
  openMultiRenameDialog,
  setOpenDialog,
  syncOtherPanelToCurrentPath,
}: AppCommandListenerOptions) => {
  useTauriSignal("new-folder-requested", () => setOpenDialog("mkdir"), [setOpenDialog]);
  useTauriSignal("new-file-requested", () => setOpenDialog("newfile"), [setOpenDialog]);
  useTauriSignal("folder-sync-requested", () => setOpenDialog("sync"), [setOpenDialog]);
  useTauriSignal("settings-requested", () => setOpenDialog("settings"), [setOpenDialog]);
  useTauriSignal(
    "target-equals-source-requested",
    syncOtherPanelToCurrentPath,
    [syncOtherPanelToCurrentPath]
  );
  useTauriSignal("swap-panels-requested", () => usePanelStore.getState().swapPanels(), []);
  useTauriSignal(
    "multi-rename-requested",
    () => {
      const state = usePanelStore.getState();
      const panelId = state.activePanel;
      const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
      openMultiRenameDialog(buildMultiRenameSession(panelId, panel));
    },
    [openMultiRenameDialog]
  );
};

export const useNativeMenuStateSync = (
  fs: NativeMenuSyncFileSystem,
  showHiddenFiles: boolean,
  themePreference: ThemePreference,
  panelViewModes: Record<PanelId, ViewMode>
) => {
  useEffect(() => {
    void fs.setShowHiddenMenuChecked(showHiddenFiles);
  }, [fs, showHiddenFiles]);

  useEffect(() => {
    void fs.setThemeMenuSelection(themePreference);
  }, [fs, themePreference]);

  useEffect(() => {
    void fs.setViewModeMenuSelection(panelViewModes.left, panelViewModes.right);
  }, [fs, panelViewModes.left, panelViewModes.right]);
};

export const useAutoTheme = (themePreference: ThemePreference) => {
  useEffect(() => {
    let timeoutId: number | undefined;

    const applyTheme = () => {
      const theme = resolveTheme(themePreference);
      document.documentElement.dataset.theme = theme;

      if (themePreference === "auto") {
        timeoutId = window.setTimeout(applyTheme, getNextThemeTransitionDelay(new Date()));
      }
    };

    const handleFocus = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      applyTheme();
    };

    applyTheme();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [themePreference]);
};
