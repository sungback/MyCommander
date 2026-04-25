import React, { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FileEntry, ViewMode } from "../../types/file";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { formatDate, formatSize } from "../../utils/format";
import { resolveEntryVisual } from "./fileVisuals";

const THUMBNAIL_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "avif",
]);

const getExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

interface ThumbnailImgProps {
  path: string;
  fallback: React.ReactNode;
  size: number;
}

const ThumbnailImg: React.FC<ThumbnailImgProps> = React.memo(({ path, fallback, size }) => {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{fallback}</>;

  return (
    <img
      src={convertFileSrc(path)}
      alt=""
      width={size}
      height={size}
      className="object-cover rounded-sm shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      loading="lazy"
      draggable={false}
    />
  );
});

interface FileItemProps {
  entry: FileEntry;
  depth?: number;
  canExpand?: boolean;
  isExpanded?: boolean;
  isSelected?: boolean;
  isCursor?: boolean;
  isActivePanel?: boolean;
  isDragSource?: boolean;
  isCut?: boolean;
  dropHint?: "copy" | "blocked" | null;
  viewMode?: ViewMode;
  gitMark?: string;
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
  isDragSource = false,
  isCut = false,
  dropHint = null,
  viewMode = "detailed",
  gitMark,
  onClick,
  onDoubleClick,
  onToggleExpand,
}) => {
  const isDir = entry.kind === "directory";
  const isHidden = Boolean(entry.isHidden);
  const disclosureOffset = depth * 14;
  const isSelectionRow = Boolean(isSelected && !isCursor);
  const visual = resolveEntryVisual(entry, { isExpanded });
  const showThumbnail = !isDir && THUMBNAIL_EXTENSIONS.has(getExt(entry.name));
  const Icon = visual.icon;
  const BadgeIcon = visual.badgeIcon;
  const isDetailed = viewMode === "detailed";
  const rowTextClass = isSelectionRow ? "theme-selection-text" : visual.nameClassName;
  const secondaryTextClass = isSelectionRow ? "theme-selection-text" : "text-text-secondary";
  const iconClassName = isSelectionRow ? "theme-selection-text" : visual.iconClassName;
  const iconWrapperClassName = isSelectionRow
    ? ""
    : visual.iconWrapperClassName;
  const badgeClassName = isSelectionRow ? "theme-selection-text" : visual.badgeClassName;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={clsx(
        "flex items-center border-b border-transparent group select-none font-mono cursor-default",
        {
          "bg-bg-selected theme-selection-text": isSelectionRow,
          "border-dotted border-accent-color": isCursor && isActivePanel,
          "border-dotted border-border-color": isCursor && !isActivePanel,
          "bg-bg-hover": isCursor,
          "text-text-primary hover:bg-bg-hover/50": !isSelected && !isCursor,
          "text-error-color/80": isSelected && isCursor,
          "opacity-60": isHidden && !isSelected,
          "opacity-55": isDragSource,
          "opacity-40": isCut,
          "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/70": dropHint === "copy",
          "bg-red-500/8 ring-1 ring-inset ring-red-400/70": dropHint === "blocked",
        }
      )}
      style={{ height: "var(--app-row-height)", fontSize: "var(--app-font-size)" }}
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
          {showThumbnail ? (
            <ThumbnailImg
              path={entry.path}
              size={visual.iconSize ?? 16}
              fallback={
                <Icon
                  size={visual.iconSize}
                  className={iconClassName}
                  fill={visual.iconFillOpacity ? "currentColor" : undefined}
                  fillOpacity={visual.iconFillOpacity}
                />
              }
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
        {gitMark && (
          <span className={clsx(
            "text-xs ml-1 shrink-0 font-semibold",
            isSelectionRow
              ? "theme-selection-text"
              : gitMark === "M" ? "text-yellow-400"
              : gitMark === "A" ? "text-green-400"
              : gitMark === "D" ? "text-red-400"
              : gitMark === "?" ? "text-zinc-400"
              : gitMark === "~" ? "text-blue-400"
              : rowTextClass
          )}>
            {gitMark}
          </span>
        )}
        {dropHint ? (
          <span
            className={clsx(
              "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
              dropHint === "copy"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            )}
          >
            {dropHint === "copy" ? "복사" : "불가"}
          </span>
        ) : null}
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
