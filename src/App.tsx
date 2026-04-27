import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { StatusBar } from "./components/layout/StatusBar";
import { DualPanel } from "./components/panel/DualPanel";
import { usePanelStore } from "./store/panelStore";
import { useKeyboard } from "./hooks/useKeyboard";
import { useFileSystem } from "./hooks/useFileSystem";
import { DialogContainer } from "./components/dialogs/DialogContainer";
import { ProgressDialog } from "./components/dialogs/ProgressDialog";
import { SearchPreviewDialogs } from "./components/dialogs/SearchPreviewDialogs";
import { SyncDialog } from "./components/dialogs/SyncDialog";
import { ContextMenu } from "./components/layout/ContextMenu";
import { MultiRenameDialog } from "./components/dialogs/MultiRenameDialog";
import { JobCenterDialog } from "./components/dialogs/JobCenterDialog";
import { ToastViewport } from "./components/layout/ToastViewport";
import { AppTheme, ThemePreference } from "./types/theme";
import { ViewMode } from "./types/file";
import { useDialogStore } from "./store/dialogStore";
import { useAppCommands } from "./hooks/useAppCommands";
import { buildMultiRenameSession } from "./features/multiRename";
import { FavoritesPanel } from "./components/favorites/FavoritesPanel";
import { useDirectoryWatch } from "./hooks/useDirectoryWatch";
import { useSettingsStore } from "./store/settingsStore";
import { buildFontFamilyStack } from "./constants/fontOptions";
import { useJobQueue } from "./hooks/useJobQueue";
import { useRendererRecovery } from "./hooks/useRendererRecovery";

type PanelId = "left" | "right";

interface PanelViewModeChangedPayload {
  panel: PanelId;
  viewMode: ViewMode;
}

const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;

const getThemeForDate = (date: Date): AppTheme => {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? "light" : "dark";
};

const getNextThemeTransitionDelay = (now: Date) => {
  const nextTransition = new Date(now);

  if (now.getHours() < DAY_START_HOUR) {
    nextTransition.setHours(DAY_START_HOUR, 0, 0, 0);
  } else if (now.getHours() < NIGHT_START_HOUR) {
    nextTransition.setHours(NIGHT_START_HOUR, 0, 0, 0);
  } else {
    nextTransition.setDate(nextTransition.getDate() + 1);
    nextTransition.setHours(DAY_START_HOUR, 0, 0, 0);
  }

  return Math.max(nextTransition.getTime() - now.getTime(), 1000);
};

const resolveTheme = (themePreference: ThemePreference): AppTheme => {
  if (themePreference === "auto") {
    return getThemeForDate(new Date());
  }

  return themePreference;
};

function App() {
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const setShowHiddenFiles = usePanelStore((s) => s.setShowHiddenFiles);
  const themePreference = usePanelStore((s) => s.themePreference);
  const setThemePreference = usePanelStore((s) => s.setThemePreference);
  const panelViewModes = usePanelStore((s) => s.panelViewModes);
  const setPanelViewMode = usePanelStore((s) => s.setPanelViewMode);
  const setOpenDialog = useDialogStore((s) => s.setOpenDialog);
  const openMultiRenameDialog = useDialogStore((s) => s.openMultiRenameDialog);
  const { syncOtherPanelToCurrentPath } = useAppCommands();
  const fs = useFileSystem();

  // Initialize global shortcuts
  useKeyboard();
  useDirectoryWatch();
  useJobQueue();
  useRendererRecovery();

  // Global Keyboard listener for Tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setActivePanel(activePanelId === "left" ? "right" : "left");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanelId, setActivePanel]);

  useEffect(() => {
    //     if (!isMacPlatform()) {
    //       return;
    //     }

    let isMounted = true;

    const attachListener = async () => {
      const unlisten = await listen<boolean>("show-hidden-files-changed", (event) => {
        if (!isMounted) {
          return;
        }

        setShowHiddenFiles(Boolean(event.payload));
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [setShowHiddenFiles]);

  useEffect(() => {
    //     if (!isMacPlatform()) {
    //       return;
    //     }

    let isMounted = true;

    const attachListener = async () => {
      const unlisten = await listen<ThemePreference>("theme-preference-changed", (event) => {
        if (!isMounted) {
          return;
        }

        if (
          event.payload === "auto" ||
          event.payload === "light" ||
          event.payload === "dark"
        ) {
          setThemePreference(event.payload);
        }
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [setThemePreference]);

  useEffect(() => {
    let isMounted = true;

    const attachListener = async () => {
      const unlisten = await listen<PanelViewModeChangedPayload>("panel-view-mode-changed", (event) => {
        if (!isMounted) {
          return;
        }

        if (
          (event.payload.panel === "left" || event.payload.panel === "right") &&
          (event.payload.viewMode === "brief" || event.payload.viewMode === "detailed")
        ) {
          setPanelViewMode(event.payload.panel, event.payload.viewMode);
        }
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [setPanelViewMode]);

  useEffect(() => {
    let isMounted = true;

    const attachListener = async () => {
      const [
        unlistenNewFolder,
        unlistenNewFile,
        unlistenMultiRename,
        unlistenFolderSync,
        unlistenTargetEqualsSource,
        unlistenSwapPanels,
        unlistenSettings,
      ] = await Promise.all([
        listen("new-folder-requested", () => {
          if (!isMounted) {
            return;
          }

          setOpenDialog("mkdir");
        }),
        listen("new-file-requested", () => {
          if (!isMounted) {
            return;
          }

          setOpenDialog("newfile");
        }),
        listen("multi-rename-requested", () => {
          if (!isMounted) {
            return;
          }

          const state = usePanelStore.getState();
          const panelId = state.activePanel;
          const panel = panelId === "left" ? state.leftPanel : state.rightPanel;
          openMultiRenameDialog(buildMultiRenameSession(panelId, panel));
        }),
        listen("folder-sync-requested", () => {
          if (!isMounted) {
            return;
          }

          setOpenDialog("sync");
        }),
        listen("target-equals-source-requested", () => {
          if (!isMounted) {
            return;
          }

          syncOtherPanelToCurrentPath();
        }),
        listen("swap-panels-requested", () => {
          if (!isMounted) {
            return;
          }

          usePanelStore.getState().swapPanels();
        }),
        listen("settings-requested", () => {
          if (!isMounted) {
            return;
          }

          setOpenDialog("settings");
        }),
      ]);

      if (!isMounted) {
        unlistenNewFolder();
        unlistenNewFile();
        unlistenMultiRename();
        unlistenFolderSync();
        unlistenTargetEqualsSource();
        unlistenSwapPanels();
        unlistenSettings();
      }

      return () => {
        unlistenNewFolder();
        unlistenNewFile();
        unlistenMultiRename();
        unlistenFolderSync();
        unlistenTargetEqualsSource();
        unlistenSwapPanels();
        unlistenSettings();
      };
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [openMultiRenameDialog, setOpenDialog, syncOtherPanelToCurrentPath]);

  useEffect(() => {
    //     if (!isMacPlatform()) {
    //       return;
    //     }

    void fs.setShowHiddenMenuChecked(showHiddenFiles);
  }, [fs, showHiddenFiles]);

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

  useEffect(() => {
    //     if (!isMacPlatform()) {
    //       return;
    //     }

    void fs.setThemeMenuSelection(themePreference);
  }, [fs, themePreference]);

  useEffect(() => {
    void fs.setViewModeMenuSelection(panelViewModes.left, panelViewModes.right);
  }, [fs, panelViewModes.left, panelViewModes.right]);

  const settings = useSettingsStore();

  return (
    <div
      className="flex flex-col h-screen bg-bg-primary text-text-primary font-sans overflow-hidden"
      style={{
        "--app-font-family": buildFontFamilyStack(settings.fontFamily),
        "--app-font-size": `${settings.fontSize}px`,
        "--app-row-height": `${Math.max(24, settings.fontSize * 2)}px`,
        fontSize: "var(--app-font-size)",
        fontFamily: "var(--app-font-family)",
      } as React.CSSProperties}
    >
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <FavoritesPanel />
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <DualPanel />
        </div>
      </div>
      <StatusBar />
      <DialogContainer />
      <ProgressDialog />
      <JobCenterDialog />
      <MultiRenameDialog />
      <SearchPreviewDialogs />
      <SyncDialog />
      <ContextMenu />
      <ToastViewport />
    </div>
  );
}

export default App;
