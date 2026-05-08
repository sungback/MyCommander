import type React from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { FileEntry, ViewMode } from "../../types/file";
import type { GitStatus } from "../../store/gitStatusStore";
import { FileItem } from "./FileItem";
import { getFileEntryDataAttributes } from "./fileEntryElement";
import { getGitMarkForEntry } from "./fileListGitMark";
import type { FileListDropUiState } from "./useFileListDropUiState";
import type { VisibleEntryRow } from "./fileListRows";

interface FileListVirtualRowsProps {
  cutPaths: Set<string> | null;
  cursorIndex: number;
  dropUiState: FileListDropUiState;
  gitStatus: GitStatus | null;
  isActivePanel: boolean;
  isLocalDragActive: boolean;
  onEnter: (entry: FileEntry) => void;
  onMouseDown: (event: React.MouseEvent, entry: FileEntry) => void;
  onRowClick: (
    event: React.MouseEvent<HTMLDivElement>,
    rowIndex: number,
    entry: FileEntry
  ) => void;
  onToggleExpand: (rowIndex: number, entry: FileEntry) => void;
  selectedItems: Set<string>;
  totalHeight: number;
  viewMode: ViewMode;
  virtualItems: VirtualItem[];
  visibleRows: VisibleEntryRow[];
}

export const FileListVirtualRows = ({
  cutPaths,
  cursorIndex,
  dropUiState,
  gitStatus,
  isActivePanel,
  isLocalDragActive,
  onEnter,
  onMouseDown,
  onRowClick,
  onToggleExpand,
  selectedItems,
  totalHeight,
  viewMode,
  virtualItems,
  visibleRows,
}: FileListVirtualRowsProps) => (
  <div className="relative min-h-full w-full" style={{ height: `${totalHeight}px` }}>
    {virtualItems.map((virtualItem) => {
      const row = visibleRows[virtualItem.index];
      const entry = row.entry;
      return (
        <div
          key={`${entry.path}:${row.depth}`}
          className="absolute top-0 left-0 w-full"
          {...getFileEntryDataAttributes(entry, virtualItem.index)}
          style={{
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
          }}
          onMouseDown={(event) => onMouseDown(event, entry)}
        >
          <FileItem
            entry={entry}
            depth={row.depth}
            canExpand={row.canExpand}
            isExpanded={row.isExpanded}
            isSelected={selectedItems.has(entry.path)}
            isCursor={cursorIndex === virtualItem.index}
            isActivePanel={isActivePanel}
            isDragSource={isLocalDragActive && selectedItems.has(entry.path)}
            isCut={cutPaths?.has(entry.path) ?? false}
            dropHint={
              dropUiState.dropTargetPath === entry.path
                ? dropUiState.isDropAllowed
                  ? "copy"
                  : "blocked"
                : null
            }
            viewMode={viewMode}
            gitMark={getGitMarkForEntry(entry, gitStatus)}
            onClick={(event) => onRowClick(event, virtualItem.index, entry)}
            onDoubleClick={() => onEnter(entry)}
            onToggleExpand={() => onToggleExpand(virtualItem.index, entry)}
          />
        </div>
      );
    })}
  </div>
);
