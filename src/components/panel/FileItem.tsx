import React, { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FileEntry, ViewMode } from "../../types/file";
import { ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { formatDate, formatSize } from "../../utils/format";
import { getUnicodeFilenameDisplay } from "../../utils/unicodeFilename";
import { resolveEntryVisual } from "./fileVisuals";

const THUMBNAIL_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "avif",
]);

const getExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const getEntrySizeText = (entry: FileEntry) => {
  if (entry.kind !== "directory" || entry.name === "..") {
    return formatSize(entry.size);
  }

  switch (entry.sizeStatus) {
    case "estimating":
      return "...";
    case "calculating":
      return entry.size === undefined || entry.size === null
        ? "calc..."
        : `${formatSize(entry.size)}+`;
    case "estimated":
      return entry.size === undefined || entry.size === null
        ? "..."
        : `~${formatSize(entry.size)}`;
    case "partial":
      return entry.size === undefined || entry.size === null
        ? "-"
        : `${formatSize(entry.size)}+`;
    case "exact":
      return entry.size === undefined || entry.size === null
        ? "-"
        : formatSize(entry.size);
    case "error":
    case "unknown":
      return "-";
    default:
      return entry.size === undefined || entry.size === null
        ? "-"
        : formatSize(entry.size);
  }
};

const getEntrySizeTitle = (entry: FileEntry) => {
  if (entry.kind !== "directory" || entry.name === "..") {
    return undefined;
  }

  switch (entry.sizeStatus) {
    case "estimating":
      return "크기를 추정하는 중입니다.";
    case "calculating":
      return "정확한 크기를 계산하는 중입니다.";
    case "estimated":
      return "빠른 추정 크기입니다.";
    case "partial":
      return "부분 계산 결과입니다. 접근할 수 없는 항목이 있을 수 있습니다.";
    case "exact":
      return "정확히 계산된 크기입니다.";
    case "error":
      return "크기를 계산하지 못했습니다.";
    case "unknown":
      return "아직 계산되지 않은 크기입니다.";
    default:
      return undefined;
  }
};

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
  const filenameDisplay = getUnicodeFilenameDisplay(entry.name);
  const showThumbnail = !isDir && THUMBNAIL_EXTENSIONS.has(getExt(entry.name));
  const Icon = visual.icon;
  const isDetailed = viewMode === "detailed";
  const rowTextClass = isSelectionRow ? "theme-selection-text" : visual.nameClassName;
  const secondaryTextClass = isSelectionRow ? "theme-selection-text" : "text-text-secondary";
  const iconClassName = visual.iconClassName;
  const iconWrapperClassName = showThumbnail
    ? "theme-file-thumbnail-shell"
    : visual.iconWrapperClassName;
  const overlayClassName = visual.overlayClassName;
  const extensionLabel = visual.extensionLabel;
  const extensionLabelClassName = visual.extensionLabelClassName;
  const entrySizeText = getEntrySizeText(entry);
  const entrySizeTitle = getEntrySizeTitle(entry);
  const isSizeBusy =
    entry.kind === "directory" &&
    (entry.sizeStatus === "estimating" || entry.sizeStatus === "calculating");
  const renderIconContents = () => (
    <>
      <Icon
        size={visual.iconSize}
        className={iconClassName}
        strokeWidth={visual.iconStrokeWidth ?? 1.9}
        fill={visual.iconFillOpacity ? "currentColor" : undefined}
        fillOpacity={visual.iconFillOpacity}
      />
      {extensionLabel ? (
        <span
          aria-hidden="true"
          className={clsx("theme-tc-extension-label", extensionLabelClassName)}
        >
          {extensionLabel}
        </span>
      ) : null}
      {overlayClassName ? (
        <span
          aria-hidden="true"
          className={clsx("theme-tc-overlay", overlayClassName)}
        />
      ) : null}
    </>
  );

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role="option"
      aria-selected={Boolean(isSelected)}
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
              size={16}
              fallback={
                <span className={clsx("relative shrink-0", visual.iconWrapperClassName)}>
                  {renderIconContents()}
                </span>
              }
            />
          ) : (
            renderIconContents()
          )}
        </span>
        <span
          className={clsx("truncate", rowTextClass, {
            [visual.nameWeightClassName]: Boolean(visual.nameWeightClassName),
          })}
        >
          {filenameDisplay.displayName}
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
            title={entrySizeTitle}
            aria-label={entrySizeTitle ? `Size: ${entrySizeText}. ${entrySizeTitle}` : undefined}
            aria-busy={isSizeBusy || undefined}
          >
            {entrySizeText}
          </div>
          <div className={clsx("w-36 px-2 whitespace-nowrap", secondaryTextClass)}>
            {formatDate(entry.lastModified)}
          </div>
        </>
      ) : null}
    </div>
  );
});
