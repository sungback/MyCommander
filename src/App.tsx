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
import { useDialogStore } from "./store/dialogStore";
import { useAppCommands } from "./hooks/useAppCommands";
import { FavoritesPanel } from "./components/favorites/FavoritesPanel";
import { useDirectoryWatch } from "./hooks/useDirectoryWatch";
import { useSettingsStore } from "./store/settingsStore";
import { buildFontFamilyStack } from "./constants/fontOptions";
import { useJobQueue } from "./hooks/useJobQueue";
import { useRendererRecovery } from "./hooks/useRendererRecovery";
import {
  useAppCommandListeners,
  useAutoTheme,
  useNativeMenuStateSync,
  useNativePreferenceListeners,
  usePanelFocusShortcut,
} from "./hooks/useAppLifecycle";

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
  usePanelFocusShortcut(activePanelId, setActivePanel);
  useNativePreferenceListeners(setShowHiddenFiles, setThemePreference, setPanelViewMode);
  useAppCommandListeners({
    openMultiRenameDialog,
    setOpenDialog,
    syncOtherPanelToCurrentPath,
  });
  useNativeMenuStateSync(fs, showHiddenFiles, themePreference, panelViewModes);
  useAutoTheme(themePreference);

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
