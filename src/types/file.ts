export type FileType = "file" | "directory" | "symlink";

export interface FileEntry {
  name: string;
  path: string;
  kind: FileType;
  size?: number | null; // Directories might not have a quick size
  lastModified?: number | null; // Timestamp
  isHidden?: boolean;
}

export type SortField = "name" | "ext" | "size" | "date";
export type SortDirection = "asc" | "desc";

export interface PanelViewState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  files: FileEntry[];
  selectedItems: Set<string>; // Set of paths
  cursorIndex: number; // For keyboard navigation
  sortField: SortField;
  sortDirection: SortDirection;
  lastUpdated: number;
}

export interface PanelTabState extends PanelViewState {
  id: string;
}

export interface PanelState extends PanelViewState {
  id: "left" | "right";
  tabs: PanelTabState[];
  activeTabId: string;
}
