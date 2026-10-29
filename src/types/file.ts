export type FileType = "file" | "directory" | "symlink";
export type ViewMode = "brief" | "detailed";
export type PanelId = "left" | "right";
export type DirectorySizeStatus =
  | "unknown"
  | "estimating"
  | "estimated"
  | "calculating"
  | "exact"
  | "limited"
  | "partial"
  | "error";

// 끝까지 계산이 끝난 크기 상태. limited는 권한이 없어 읽지 못한 항목을 뺀 하한값이다.
export type ConfirmedDirectorySizeStatus = Extract<DirectorySizeStatus, "exact" | "limited">;

// 상위 폴더를 정확 계산하며 함께 구한 하위 폴더 결과. 그 폴더만 따로 계산한 값과 같다.
export interface ScannedChildDirectorySize {
  path: string;
  size: number;
  isPartial: boolean;
  inaccessibleCount: number;
  // 스캔한 폴더로부터의 깊이(바로 아래가 1)
  depth: number;
}

export interface FileEntry {
  name: string;
  path: string;
  kind: FileType;
  size?: number | null; // Directories might not have a quick size
  sizeStatus?: DirectorySizeStatus;
  lastModified?: number | null; // Timestamp
  isHidden?: boolean;
}

export type SortField = "name" | "ext" | "size" | "date";
export type SortDirection = "asc" | "desc";

export interface PanelViewState {
  currentPath: string;
  resolvedPath?: string;
  history: string[];
  historyIndex: number;
  files: FileEntry[];
  selectedItems: Set<string>; // Set of paths
  cursorIndex: number; // For keyboard navigation
  sortField: SortField;
  sortDirection: SortDirection;
  lastUpdated: number;
  pendingCursorName: string | null; // folder name to focus after navigating up
}

export interface PanelTabState extends PanelViewState {
  id: string;
  expandedChildrenVersion: number;
}

export interface PanelState extends PanelViewState {
  id: PanelId;
  tabs: PanelTabState[];
  activeTabId: string;
}
