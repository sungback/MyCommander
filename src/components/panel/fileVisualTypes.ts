import type { LucideIcon } from "lucide-react";

export type EntryVisualGroup =
  | "folder-parent"
  | "folder"
  | "folder-open"
  | "folder-hidden"
  | "folder-app-bundle"
  | "file-hidden"
  | "file-document"
  | "file-pdf"
  | "file-spreadsheet"
  | "file-presentation"
  | "file-data"
  | "file-image"
  | "file-archive"
  | "file-code"
  | "file-config"
  | "file-audio"
  | "file-video"
  | "file-installer"
  | "file-app"
  | "file-default";

export type EntryVisualSlot =
  | "tc-folder-parent"
  | "tc-folder-closed"
  | "tc-folder-open"
  | "tc-folder-hidden"
  | "tc-folder-app"
  | "tc-file-standard"
  | "tc-file-text"
  | "tc-file-associated"
  | "tc-file-archive"
  | "tc-file-program"
  | "tc-file-hidden";

export type FileVisualGroup = Extract<
  EntryVisualGroup,
  | "file-document"
  | "file-pdf"
  | "file-spreadsheet"
  | "file-presentation"
  | "file-data"
  | "file-image"
  | "file-archive"
  | "file-code"
  | "file-config"
  | "file-audio"
  | "file-video"
  | "file-installer"
  | "file-app"
  | "file-default"
>;

export interface EntryVisual {
  group: EntryVisualGroup;
  slot: EntryVisualSlot;
  icon: LucideIcon;
  iconSize: number;
  iconClassName: string;
  iconWrapperClassName: string;
  iconFillOpacity?: number;
  iconStrokeWidth?: number;
  nameClassName: string;
  nameWeightClassName: string;
  overlayClassName?: string;
  extensionLabel?: string;
  extensionLabelClassName?: string;
}

export interface ResolveEntryVisualOptions {
  isExpanded?: boolean;
}
