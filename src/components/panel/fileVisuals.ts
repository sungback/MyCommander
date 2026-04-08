import type { LucideIcon } from "lucide-react";
import { getIcon as getMaterialFileIcon } from "material-file-icons";
import {
  ArrowUpToLine,
  Download,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  FileVideoCamera,
  FolderClosed,
  FolderOpen,
  Music4,
  Package,
  Settings2,
} from "lucide-react";
import { FileEntry } from "../../types/file";

const DOCUMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "rtf",
  "csv",
]);
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
  | "file-image"
  | "file-archive"
  | "file-code"
  | "file-config"
  | "file-media"
  | "file-installer"
  | "file-app"
  | "file-default";

type FileVisualGroup = Extract<
  EntryVisualGroup,
  | "file-document"
  | "file-image"
  | "file-archive"
  | "file-code"
  | "file-config"
  | "file-media"
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
  nameClassName: string;
  nameWeightClassName: string;
  svgMarkup?: string;
  svgClassName?: string;
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

  if (
    (extension !== null && AUDIO_EXTENSIONS.has(extension)) ||
    (extension !== null && VIDEO_EXTENSIONS.has(extension))
  ) {
    return "file-media";
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
    iconSize: 14,
    iconClassName: "theme-file-document-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-document-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-image": {
    group: "file-image",
    icon: FileImage,
    iconSize: 14,
    iconClassName: "theme-file-image-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-image-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-archive": {
    group: "file-archive",
    icon: FileArchive,
    iconSize: 14,
    iconClassName: "theme-file-archive-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-archive-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-code": {
    group: "file-code",
    icon: FileCode,
    iconSize: 14,
    iconClassName: "theme-file-code-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-code-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-config": {
    group: "file-config",
    icon: Settings2,
    iconSize: 14,
    iconClassName: "theme-file-config-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-config-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-media": {
    group: "file-media",
    icon: Music4,
    iconSize: 14,
    iconClassName: "theme-file-media-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-media-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-installer": {
    group: "file-installer",
    icon: Package,
    iconSize: 14,
    iconClassName: "theme-file-installer-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-installer-plate",
    badgeIcon: Download,
    badgeClassName: "theme-file-installer-badge",
    nameClassName: "theme-file-installer-name",
    nameWeightClassName: "font-semibold",
    svgClassName: "theme-material-file-icon",
  },
  "file-app": {
    group: "file-app",
    icon: Package,
    iconSize: 14,
    iconClassName: "theme-file-app-icon",
    iconWrapperClassName: "theme-file-icon-plate theme-file-app-plate",
    nameClassName: "theme-file-app-name",
    nameWeightClassName: "font-medium",
    svgClassName: "theme-material-file-icon",
  },
  "file-default": {
    group: "file-default",
    icon: File,
    iconSize: 14,
    iconClassName: "theme-file-default-icon",
    iconWrapperClassName: "theme-file-icon-plate",
    nameClassName: "theme-file-default-name",
    nameWeightClassName: "",
    svgClassName: "theme-material-file-icon",
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
        iconFillOpacity: 0.26,
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
      iconFillOpacity: 0.22,
      nameClassName: "theme-folder-name",
      nameWeightClassName: "font-semibold",
    };
  }

  const group = getFileGroup(entry);
  const visual = FILE_VISUALS[group];
  const svgMarkup = getMaterialFileIcon(entry.name).svg;

  if (group === "file-media") {
    const extension = getFileExtension(entry.name);
    if (extension !== null && VIDEO_EXTENSIONS.has(extension)) {
      return {
        ...visual,
        icon: FileVideoCamera,
        svgMarkup,
      };
    }
  }

  return {
    ...visual,
    svgMarkup,
  };
};
