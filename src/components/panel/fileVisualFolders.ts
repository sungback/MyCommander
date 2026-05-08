import { ArrowUpToLine, FolderClosed, FolderOpen, Package } from "lucide-react";
import { FileEntry } from "../../types/file";
import { APP_BUNDLE_EXTENSIONS } from "./fileVisualCatalog";
import type { EntryVisual, ResolveEntryVisualOptions } from "./fileVisualTypes";
import { getFileExtension } from "./fileVisualNames";

export const resolveDirectoryVisual = (
  entry: FileEntry,
  options: ResolveEntryVisualOptions
): EntryVisual => {
  const extension = getFileExtension(entry.name);

  if (entry.name === "..") {
    return {
      group: "folder-parent",
      slot: "tc-folder-parent",
      icon: ArrowUpToLine,
      iconSize: 15,
      iconClassName: "theme-folder-parent-icon",
      iconWrapperClassName: "theme-tc-folder-shell theme-tc-folder-parent-shell",
      iconFillOpacity: undefined,
      nameClassName: "theme-tc-folder-name",
      nameWeightClassName: "font-semibold",
    };
  }

  if (extension !== null && APP_BUNDLE_EXTENSIONS.has(extension)) {
    return {
      group: "folder-app-bundle",
      slot: "tc-folder-app",
      icon: Package,
      iconSize: 15,
      iconClassName: "theme-folder-app-bundle-icon",
      iconWrapperClassName: "theme-tc-folder-shell theme-tc-folder-app-shell",
      iconFillOpacity: 0.18,
      nameClassName: "theme-tc-folder-name",
      nameWeightClassName: "font-semibold",
    };
  }

  if (entry.isHidden) {
    return {
      group: "folder-hidden",
      slot: "tc-folder-hidden",
      icon: options.isExpanded ? FolderOpen : FolderClosed,
      iconSize: 16,
      iconClassName: "theme-folder-hidden-icon",
      iconWrapperClassName: "theme-tc-folder-shell theme-tc-folder-hidden-shell",
      iconFillOpacity: 0.24,
      iconStrokeWidth: 1.65,
      nameClassName: "theme-tc-hidden-name",
      nameWeightClassName: "font-semibold",
      overlayClassName: "theme-tc-overlay-hidden",
    };
  }

  if (options.isExpanded) {
    return {
      group: "folder-open",
      slot: "tc-folder-open",
      icon: FolderOpen,
      iconSize: 16,
      iconClassName: "theme-folder-open-icon",
      iconWrapperClassName: "theme-tc-folder-shell theme-tc-folder-open-shell",
      iconFillOpacity: 0.78,
      iconStrokeWidth: 1.65,
      nameClassName: "theme-tc-folder-name",
      nameWeightClassName: "font-semibold",
    };
  }

  return {
    group: "folder",
    slot: "tc-folder-closed",
    icon: FolderClosed,
    iconSize: 16,
    iconClassName: "theme-folder-icon",
    iconWrapperClassName: "theme-tc-folder-shell theme-tc-folder-closed-shell",
    iconFillOpacity: 0.72,
    iconStrokeWidth: 1.65,
    nameClassName: "theme-tc-folder-name",
    nameWeightClassName: "font-semibold",
  };
};
