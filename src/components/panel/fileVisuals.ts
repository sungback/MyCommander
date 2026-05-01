import type { LucideIcon } from "lucide-react";
import {
  ArrowUpToLine,
  Archive,
  AudioLines,
  Database,
  Download,
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo2,
  FolderClosed,
  FolderOpen,
  Image,
  Package,
  PackageOpen,
  Presentation,
  SlidersHorizontal,
} from "lucide-react";
import { FileEntry } from "../../types/file";

const DOCUMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "doc",
  "docx",
  "rtf",
  "odt",
  "pages",
]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "ods", "numbers"]);
const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "odp", "key"]);
const DATA_EXTENSIONS = new Set(["csv", "tsv", "parquet", "sqlite", "sqlite3", "db"]);
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "heic",
  "avif",
]);
const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "bz2",
  "xz",
  "tgz",
]);
const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "jsonc",
  "rs",
  "py",
  "java",
  "kt",
  "go",
  "rb",
  "php",
  "swift",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "cs",
  "html",
  "css",
  "scss",
  "sass",
  "sql",
  "sh",
  "zsh",
  "bash",
]);
const CONFIG_EXTENSIONS = new Set([
  "env",
  "gitignore",
  "editorconfig",
  "ini",
  "cfg",
  "conf",
  "yaml",
  "yml",
  "toml",
  "lock",
]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "flac", "aac", "ogg", "m4a"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mkv", "mov", "avi", "webm", "wmv", "m4v"]);
const APP_BUNDLE_EXTENSIONS = new Set(["app"]);
const INSTALLER_EXTENSIONS = new Set(["dmg", "pkg", "exe", "msi", "deb", "rpm", "apk", "appimage"]);
const DOCUMENT_FILENAMES = new Set(["readme", "license", "changelog"]);
const ARCHIVE_SUFFIXES = [".tar.gz", ".tar.bz2", ".tar.xz"];

export type EntryVisualGroup =
  | "folder-parent"
  | "folder"
  | "folder-open"
  | "folder-hidden"
  | "folder-app-bundle"
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

type FileVisualGroup = Extract<
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
  icon: LucideIcon;
  iconSize: number;
  iconClassName: string;
  iconWrapperClassName: string;
  iconFillOpacity?: number;
  iconStrokeWidth?: number;
  nameClassName: string;
  nameWeightClassName: string;
  badgeIcon?: LucideIcon;
  badgeClassName?: string;
}

interface ResolveEntryVisualOptions {
  isExpanded?: boolean;
}

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

const FILE_VISUALS: Record<
  FileVisualGroup,
  EntryVisual
> = {
  "file-document": {
    group: "file-document",
    icon: FileText,
    iconSize: 12,
    iconClassName: "theme-file-document-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-document-plate",
    nameClassName: "theme-file-document-name",
    nameWeightClassName: "font-medium",
  },
  "file-pdf": {
    group: "file-pdf",
    icon: FileType2,
    iconSize: 12,
    iconClassName: "theme-file-pdf-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-pdf-plate",
    nameClassName: "theme-file-pdf-name",
    nameWeightClassName: "font-medium",
  },
  "file-spreadsheet": {
    group: "file-spreadsheet",
    icon: FileSpreadsheet,
    iconSize: 12,
    iconClassName: "theme-file-spreadsheet-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-spreadsheet-plate",
    nameClassName: "theme-file-spreadsheet-name",
    nameWeightClassName: "font-medium",
  },
  "file-presentation": {
    group: "file-presentation",
    icon: Presentation,
    iconSize: 12,
    iconClassName: "theme-file-presentation-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-presentation-plate",
    nameClassName: "theme-file-presentation-name",
    nameWeightClassName: "font-medium",
  },
  "file-data": {
    group: "file-data",
    icon: Database,
    iconSize: 12,
    iconClassName: "theme-file-data-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-data-plate",
    nameClassName: "theme-file-data-name",
    nameWeightClassName: "font-medium",
  },
  "file-image": {
    group: "file-image",
    icon: Image,
    iconSize: 12,
    iconClassName: "theme-file-image-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-image-plate",
    nameClassName: "theme-file-image-name",
    nameWeightClassName: "font-medium",
  },
  "file-archive": {
    group: "file-archive",
    icon: Archive,
    iconSize: 12,
    iconClassName: "theme-file-archive-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-archive-plate",
    nameClassName: "theme-file-archive-name",
    nameWeightClassName: "font-medium",
  },
  "file-code": {
    group: "file-code",
    icon: FileCode2,
    iconSize: 12,
    iconClassName: "theme-file-code-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-code-plate",
    nameClassName: "theme-file-code-name",
    nameWeightClassName: "font-medium",
  },
  "file-config": {
    group: "file-config",
    icon: SlidersHorizontal,
    iconSize: 12,
    iconClassName: "theme-file-config-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-config-plate",
    nameClassName: "theme-file-config-name",
    nameWeightClassName: "font-medium",
  },
  "file-audio": {
    group: "file-audio",
    icon: AudioLines,
    iconSize: 12,
    iconClassName: "theme-file-audio-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-audio-plate",
    nameClassName: "theme-file-audio-name",
    nameWeightClassName: "font-medium",
  },
  "file-video": {
    group: "file-video",
    icon: FileVideo2,
    iconSize: 12,
    iconClassName: "theme-file-video-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-video-plate",
    nameClassName: "theme-file-video-name",
    nameWeightClassName: "font-medium",
  },
  "file-installer": {
    group: "file-installer",
    icon: PackageOpen,
    iconSize: 12,
    iconClassName: "theme-file-installer-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-installer-plate",
    badgeIcon: Download,
    badgeClassName: "theme-file-installer-badge",
    nameClassName: "theme-file-installer-name",
    nameWeightClassName: "font-semibold",
  },
  "file-app": {
    group: "file-app",
    icon: Package,
    iconSize: 12,
    iconClassName: "theme-file-app-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-app-plate",
    nameClassName: "theme-file-app-name",
    nameWeightClassName: "font-medium",
  },
  "file-default": {
    group: "file-default",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-file-default-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-default-plate",
    nameClassName: "theme-file-default-name",
    nameWeightClassName: "",
  },
};

export const resolveEntryVisual = (
  entry: FileEntry,
  options: ResolveEntryVisualOptions = {}
): EntryVisual => {
  if (entry.kind === "directory") {
    const extension = getFileExtension(entry.name);

    if (entry.name === "..") {
      return {
        group: "folder-parent",
        icon: ArrowUpToLine,
        iconSize: 15,
        iconClassName: "theme-folder-parent-icon",
        iconWrapperClassName: "theme-folder-parent-icon-shell",
        iconFillOpacity: undefined,
        nameClassName: "theme-folder-parent-name",
        nameWeightClassName: "font-semibold",
      };
    }

    if (extension !== null && APP_BUNDLE_EXTENSIONS.has(extension)) {
      return {
        group: "folder-app-bundle",
        icon: Package,
        iconSize: 15,
        iconClassName: "theme-folder-app-bundle-icon",
        iconWrapperClassName: "theme-folder-app-bundle-icon-shell",
        iconFillOpacity: 0.18,
        nameClassName: "theme-folder-app-bundle-name",
        nameWeightClassName: "font-semibold",
      };
    }

    if (entry.isHidden) {
      return {
        group: "folder-hidden",
        icon: options.isExpanded ? FolderOpen : FolderClosed,
        iconSize: 16,
        iconClassName: "theme-folder-hidden-icon",
        iconWrapperClassName: "theme-folder-icon-shell",
        iconFillOpacity: 0.24,
        iconStrokeWidth: 1.65,
        nameClassName: "theme-folder-hidden-name",
        nameWeightClassName: "font-semibold",
      };
    }

    if (options.isExpanded) {
      return {
        group: "folder-open",
        icon: FolderOpen,
        iconSize: 16,
        iconClassName: "theme-folder-open-icon",
        iconWrapperClassName: "theme-folder-icon-shell",
        iconFillOpacity: 0.78,
        iconStrokeWidth: 1.65,
        nameClassName: "theme-folder-open-name",
        nameWeightClassName: "font-semibold",
      };
    }

    return {
      group: "folder",
      icon: FolderClosed,
      iconSize: 16,
      iconClassName: "theme-folder-icon",
      iconWrapperClassName: "theme-folder-icon-shell",
      iconFillOpacity: 0.72,
      iconStrokeWidth: 1.65,
      nameClassName: "theme-folder-name",
      nameWeightClassName: "font-semibold",
    };
  }

  const group = getFileGroup(entry);
  const visual = FILE_VISUALS[group];

  return visual;
};
