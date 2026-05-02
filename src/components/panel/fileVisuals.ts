import { ArrowUpToLine, FolderClosed, FolderOpen, Package } from "lucide-react";
import { FileEntry } from "../../types/file";
import {
  APP_BUNDLE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  ARCHIVE_LABEL_SUFFIX_CLASSES,
  ARCHIVE_LABEL_SUFFIXES,
  ARCHIVE_SUFFIXES,
  AUDIO_EXTENSIONS,
  CODE_EXTENSIONS,
  CONFIG_EXTENSIONS,
  DATA_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_FILENAMES,
  EXTENSION_LABEL_CLASS_OVERRIDES,
  EXTENSION_LABEL_OVERRIDES,
  FILENAME_LABEL_CLASS_OVERRIDES,
  FILENAME_LABEL_OVERRIDES,
  IMAGE_EXTENSIONS,
  INSTALLER_EXTENSIONS,
  PDF_EXTENSIONS,
  PRESENTATION_EXTENSIONS,
  SPREADSHEET_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "./fileVisualCatalog";
import { FILE_VISUALS, HIDDEN_FILE_VISUAL } from "./fileVisualDefinitions";
import type {
  EntryVisual,
  EntryVisualGroup,
  FileVisualGroup,
  ResolveEntryVisualOptions,
} from "./fileVisualTypes";

export type {
  EntryVisual,
  EntryVisualGroup,
  EntryVisualSlot,
  ResolveEntryVisualOptions,
} from "./fileVisualTypes";

const getNameStem = (name: string) => {
  const lowerName = name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");
  return dotIndex > 0 ? lowerName.slice(0, dotIndex) : lowerName;
};

export const getFileExtension = (name: string): string | null => {
  const lowerName = name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");

  if (
    dotIndex === -1 ||
    dotIndex === lowerName.length - 1 ||
    (dotIndex === 0 && lowerName.indexOf(".", 1) === -1 && lowerName.length <= 1)
  ) {
    return null;
  }

  return lowerName.slice(dotIndex + 1);
};

const isArchiveName = (name: string, extension: string | null) => {
  const lowerName = name.toLowerCase();
  return (
    ARCHIVE_SUFFIXES.some((suffix) => lowerName.endsWith(suffix)) ||
    (extension !== null && ARCHIVE_EXTENSIONS.has(extension))
  );
};

const toShortLabel = (value: string) =>
  value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3);

const getExtensionLabel = (name: string, group: EntryVisualGroup) => {
  const lowerName = name.toLowerCase();

  if (group === "file-archive") {
    const archiveLabel = ARCHIVE_LABEL_SUFFIXES.find(([suffix]) =>
      lowerName.endsWith(suffix)
    )?.[1];
    if (archiveLabel) {
      return archiveLabel;
    }
  }

  const extension = getFileExtension(name);
  if (extension !== null) {
    return EXTENSION_LABEL_OVERRIDES[extension] ?? toShortLabel(extension);
  }

  const nameStem = getNameStem(name);
  return FILENAME_LABEL_OVERRIDES[nameStem] ?? "FILE";
};

const getGroupFallbackExtensionClassName = (group: EntryVisualGroup) => {
  switch (group) {
    case "file-pdf":
      return "theme-tc-ext-pdf";
    case "file-spreadsheet":
      return "theme-tc-ext-xls";
    case "file-presentation":
      return "theme-tc-ext-ppt";
    case "file-data":
      return "theme-tc-ext-data";
    case "file-image":
      return "theme-tc-ext-image";
    case "file-archive":
      return "theme-tc-ext-archive";
    case "file-code":
      return "theme-tc-ext-code";
    case "file-config":
      return "theme-tc-ext-config";
    case "file-audio":
      return "theme-tc-ext-audio";
    case "file-video":
      return "theme-tc-ext-video";
    case "file-installer":
    case "file-app":
      return "theme-tc-ext-program";
    default:
      return "theme-tc-ext-document";
  }
};

const getExtensionLabelClassName = (name: string, group: EntryVisualGroup) => {
  const lowerName = name.toLowerCase();

  if (group === "file-archive") {
    const archiveClassName = ARCHIVE_LABEL_SUFFIX_CLASSES.find(([suffix]) =>
      lowerName.endsWith(suffix)
    )?.[1];
    if (archiveClassName) {
      return archiveClassName;
    }
  }

  const extension = getFileExtension(name);
  if (extension !== null) {
    return (
      EXTENSION_LABEL_CLASS_OVERRIDES[extension] ??
      getGroupFallbackExtensionClassName(group)
    );
  }

  const nameStem = getNameStem(name);
  return FILENAME_LABEL_CLASS_OVERRIDES[nameStem] ?? getGroupFallbackExtensionClassName(group);
};

const getFileGroup = (entry: FileEntry): FileVisualGroup => {
  const extension = getFileExtension(entry.name);
  const nameStem = getNameStem(entry.name);

  if (extension !== null && IMAGE_EXTENSIONS.has(extension)) {
    return "file-image";
  }

  if (isArchiveName(entry.name, extension)) {
    return "file-archive";
  }

  if (extension !== null && AUDIO_EXTENSIONS.has(extension)) {
    return "file-audio";
  }

  if (extension !== null && VIDEO_EXTENSIONS.has(extension)) {
    return "file-video";
  }

  if (extension !== null && INSTALLER_EXTENSIONS.has(extension)) {
    return "file-installer";
  }

  if (extension !== null && APP_BUNDLE_EXTENSIONS.has(extension)) {
    return "file-app";
  }

  if (extension !== null && CODE_EXTENSIONS.has(extension)) {
    return "file-code";
  }

  if (extension !== null && CONFIG_EXTENSIONS.has(extension)) {
    return "file-config";
  }

  if (extension !== null && PDF_EXTENSIONS.has(extension)) {
    return "file-pdf";
  }

  if (extension !== null && SPREADSHEET_EXTENSIONS.has(extension)) {
    return "file-spreadsheet";
  }

  if (extension !== null && PRESENTATION_EXTENSIONS.has(extension)) {
    return "file-presentation";
  }

  if (extension !== null && DATA_EXTENSIONS.has(extension)) {
    return "file-data";
  }

  if (
    (extension !== null && DOCUMENT_EXTENSIONS.has(extension)) ||
    DOCUMENT_FILENAMES.has(nameStem)
  ) {
    return "file-document";
  }

  return "file-default";
};

const withExtensionLabel = (
  visual: EntryVisual,
  entry: FileEntry,
  markerGroup: EntryVisualGroup = visual.group
): EntryVisual => ({
  ...visual,
  extensionLabel: getExtensionLabel(entry.name, markerGroup),
  extensionLabelClassName: getExtensionLabelClassName(entry.name, markerGroup),
});

export const resolveEntryVisual = (
  entry: FileEntry,
  options: ResolveEntryVisualOptions = {}
): EntryVisual => {
  if (entry.kind === "directory") {
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
  }

  if (entry.isHidden) {
    return withExtensionLabel(HIDDEN_FILE_VISUAL, entry, getFileGroup(entry));
  }

  const group = getFileGroup(entry);
  const visual = FILE_VISUALS[group];

  return withExtensionLabel(visual, entry);
};
