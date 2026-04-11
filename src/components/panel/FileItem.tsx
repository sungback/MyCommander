import React from "react";
import { FileEntry, ViewMode } from "../../types/file";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { formatDate, formatSize } from "../../utils/format";
import { resolveEntryVisual } from "./fileVisuals";

interface FileItemProps {
  entry: FileEntry;
  depth?: number;
  canExpand?: boolean;
  isExpanded?: boolean;
  isSelected?: boolean;
  isCursor?: boolean;
  isActivePanel?: boolean;
  viewMode?: ViewMode;
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
  viewMode = "detailed",
  onClick,
  onDoubleClick,
  onToggleExpand,
}) => {
  const isDir = entry.kind === "directory";
  const isHidden = Boolean(entry.isHidden);
  const disclosureOffset = depth * 14;
  const isSelectionRow = Boolean(isSelected && !isCursor);
  const visual = resolveEntryVisual(entry, { isExpanded });
  const Icon = visual.icon;
  const BadgeIcon = visual.badgeIcon;
  const isDetailed = viewMode === "detailed";
  const rowTextClass = isSelectionRow ? "theme-selection-text" : visual.nameClassName;
  const secondaryTextClass = isSelectionRow ? "theme-selection-text" : "text-text-secondary";
  const preserveFileSvgColors = Boolean(visual.svgMarkup);
  const iconClassName =
    isSelectionRow && !preserveFileSvgColors ? "theme-selection-text" : visual.iconClassName;
  const iconWrapperClassName = isSelectionRow
    ? ""
    : visual.iconWrapperClassName;
  const badgeClassName = isSelectionRow ? "theme-selection-text" : visual.badgeClassName;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={clsx(
        "flex items-center h-[28px] border-b border-transparent group select-none font-mono text-sm cursor-default",
        {
          "bg-bg-selected theme-selection-text": isSelectionRow,
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
        className={clsx(
          "flex-1 px-2 flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis",
          isDetailed && "border-r border-border-color/30"
        )}
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
            canExpand ? "hover:bg-bg-hover/70" : "pointer-events-none opacity-0"
          )}
          tabIndex={-1}
          aria-label={isExpanded ? "Collapse folder preview" : "Expand folder preview"}
        >
          {canExpand ? (
            isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
          ) : null}
        </button>
        <span className={clsx("relative shrink-0", iconWrapperClassName)}>
          {visual.svgMarkup ? (
            <span
              className={clsx("block", visual.svgClassName)}
              dangerouslySetInnerHTML={{ __html: visual.svgMarkup }}
            />
          ) : (
            <Icon
              size={visual.iconSize}
              className={iconClassName}
              fill={visual.iconFillOpacity ? "currentColor" : undefined}
              fillOpacity={visual.iconFillOpacity}
            />
          )}
          {BadgeIcon ? (
            <span className={clsx("absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full", badgeClassName)}>
              <BadgeIcon size={8} />
            </span>
          ) : null}
        </span>
        <span
          className={clsx("truncate", rowTextClass, {
            [visual.nameWeightClassName]: Boolean(visual.nameWeightClassName),
          })}
        >
          {entry.name}
        </span>
      </div>
      {isDetailed ? (
        <>
          <div
            className={clsx(
              "w-24 px-2 text-right border-r border-border-color/30",
              secondaryTextClass
            )}
          >
            {isDir && entry.name !== ".." && (entry.size === undefined || entry.size === null)
              ? "<DIR>"
              : formatSize(entry.size)}
          </div>
          <div className={clsx("w-36 px-2 whitespace-nowrap", secondaryTextClass)}>
            {formatDate(entry.lastModified)}
          </div>
        </>
      ) : null}
    </div>
  );
});
