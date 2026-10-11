import type {
  FileEntry,
  DirectorySizeStatus,
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
  sizeStatusCache: Record<string, DirectorySizeStatus>;
  sizeCacheStale: Record<string, boolean>;
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
  // scanStartedAt: 정확 스캔 시작 시각. 스캔 중 변경이 감지됐으면 완료 후에도 stale을 유지한다.
  updateEntrySize: (
    panel: PanelId,
    path: string,
    size: number,
    scanStartedAt?: number
  ) => void;
  updateEntrySizeProgress: (
    panel: PanelId,
    path: string,
    size: number
  ) => void;
  updateEntrySizeEstimate: (
    panel: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  hydrateEntrySizesFromCache: (
    entries: Array<{
      path: string;
      size: number;
      status: Extract<DirectorySizeStatus, "exact" | "estimated" | "partial">;
      isStale: boolean;
      scannedAt?: number;
    }>
  ) => void;
  invalidateEntrySizes: (paths: string[]) => void;
  markEntrySizesStale: (paths: string[]) => void;
  swapPanels: () => void;
}
