import type {
  FileEntry,
  PanelId,
  PanelState,
  SortField,
  ViewMode,
} from "../types/file";
import type { ThemePreference } from "../types/theme";
import type { PanelViewModes } from "./panelStoreReducers";

export interface AppState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  sizeCache: Record<string, number>;
  activePanel: PanelId;
  showHiddenFiles: boolean;
  themePreference: ThemePreference;
  panelViewModes: PanelViewModes;
  setActivePanel: (panel: PanelId) => void;
  setShowHiddenFiles: (show: boolean) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
  setPanelViewMode: (panel: PanelId, viewMode: ViewMode) => void;
  addTab: (panel: PanelId) => void;
  activateTab: (panel: PanelId, tabId: string) => void;
  closeTab: (panel: PanelId, tabId: string) => void;
  setPath: (panel: PanelId, path: string, pendingCursorName?: string) => void;
  setResolvedPath: (panel: PanelId, path: string) => void;
  goBack: (panel: PanelId) => void;
  goForward: (panel: PanelId) => void;
  setFiles: (panel: PanelId, files: FileEntry[]) => void;
  setSelection: (panel: PanelId, paths: string[]) => void;
  setPendingCursorName: (panel: PanelId, name: string | null) => void;
  toggleSelection: (panel: PanelId, path: string) => void;
  selectOnly: (panel: PanelId, path: string | null) => void;
  clearSelection: (panel: PanelId) => void;
  setCursor: (panel: PanelId, index: number) => void;
  refreshPanel: (panel: PanelId) => void;
  bumpExpandedChildrenVersion: (panel: PanelId) => void;
  setSort: (panel: PanelId, field: SortField) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  invalidateEntrySizes: (paths: string[]) => void;
  swapPanels: () => void;
}
