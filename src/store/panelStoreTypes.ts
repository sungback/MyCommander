import type {
  ConfirmedDirectorySizeStatus,
  FileEntry,
  DirectorySizeStatus,
  PanelId,
  PanelState,
  ScannedChildDirectorySize,
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
  // status: 권한이 없어 읽지 못한 항목이 있으면 "limited"(하한값), 없으면 "exact"(기본값).
  updateEntrySize: (
    panel: PanelId,
    path: string,
    size: number,
    scanStartedAt?: number,
    status?: ConfirmedDirectorySizeStatus
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
  // 상위 폴더 정확 계산에서 함께 구한 하위 폴더 결과를 한 번에 반영한다. scanStartedAt은 그 스캔의 시작 시각이다.
  applyScannedChildSizes: (children: ScannedChildDirectorySize[], scanStartedAt: number) => void;
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  hydrateEntrySizesFromCache: (
    entries: Array<{
      path: string;
      size: number;
      status: Extract<DirectorySizeStatus, "exact" | "limited" | "estimated" | "partial">;
      isStale: boolean;
      scannedAt?: number;
    }>
  ) => void;
  invalidateEntrySizes: (paths: string[]) => void;
  markEntrySizesStale: (paths: string[]) => void;
  swapPanels: () => void;
}
