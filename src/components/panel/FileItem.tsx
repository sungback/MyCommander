import React from "react";
import { FileEntry } from "../../types/file";
import { ChevronDown, ChevronRight, File, FolderClosed, FolderOpen } from "lucide-react";
import { clsx } from "clsx";
import { formatDate, formatSize } from "../../utils/format";

interface FileItemProps {
  entry: FileEntry;
  depth?: number;
  canExpand?: boolean;
  isExpanded?: boolean;
  isSelected?: boolean;
  isCursor?: boolean;
  isActivePanel?: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onToggleExpand?: () => void;
}

export const FileItem: React.FC<FileItemProps> = React.memo(({
  entry,
  depth = 0,
  canExpand = false,
  isExpanded = false,
  isSelected,
  isCursor,
  isActivePanel,
  onClick,
  onDoubleClick,
  onToggleExpand,
}) => {
  const isDir = entry.kind === "directory";
  const isHidden = Boolean(entry.isHidden);
  const disclosureOffset = depth * 14;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={clsx(
        "flex items-center h-[28px] border-b border-transparent group select-none font-mono text-sm",
        {
          "bg-bg-selected text-white": isSelected && !isCursor,
          "border-dotted border-accent-color": isCursor && isActivePanel,
          "border-dotted border-border-color": isCursor && !isActivePanel,
          "bg-bg-hover": isCursor,
          "text-text-primary hover:bg-bg-hover/50": !isSelected && !isCursor,
          "text-error-color/80": isSelected && isCursor,
          "opacity-60": isHidden && !isSelected,
        }
      )}
    >
      <div
        className="flex-1 px-2 flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis border-r border-border-color/30"
        style={{ paddingLeft: `${8 + disclosureOffset}px` }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand?.();
          }}
          className={clsx(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded text-text-secondary transition-colors",
            canExpand ? "hover:bg-white/8" : "pointer-events-none opacity-0"
          )}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse folder preview" : "Expand folder preview"}
        >
          {canExpand ? (
            isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
          ) : null}
        </button>
        <span className="shrink-0 text-text-secondary/70">
          {isDir ? (
            isExpanded ? (
              <FolderOpen
                size={15}
                className={isSelected ? "text-white" : "text-sky-300"}
                fill="currentColor"
                fillOpacity={0.18}
              />
            ) : (
              <FolderClosed
                size={15}
                className={isSelected ? "text-white" : "text-sky-300"}
                fill="currentColor"
                fillOpacity={0.18}
              />
            )
          ) : (
            <File size={14} />
          )}
        </span>
        <span
          className={clsx("truncate", {
            "font-bold text-sky-200": isDir && !isSelected,
            "text-white/75": isHidden && !isSelected,
          })}
        >
          {entry.name}
        </span>
      </div>
      <div className="w-24 px-2 text-right border-r border-border-color/30 text-text-secondary">
        {isDir && entry.name !== ".." && (entry.size === undefined || entry.size === null) ? "<DIR>" : formatSize(entry.size)}
      </div>
      <div className="w-36 px-2 text-text-secondary whitespace-nowrap">
        {formatDate(entry.lastModified)}
      </div>
    </div>
  );
});
