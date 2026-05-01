import type { LucideIcon } from "lucide-react";
import {
  ArrowUpToLine,
  Archive,
  File,
  FileText,
  FolderClosed,
  FolderOpen,
  Package,
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

const EXTENSION_LABEL_OVERRIDES: Record<string, string> = {
  markdown: "MD",
  docx: "DOC",
  pages: "DOC",
  xlsx: "XLS",
  ods: "XLS",
  numbers: "XLS",
  pptx: "PPT",
  odp: "PPT",
  key: "PPT",
  sqlite: "DB",
  sqlite3: "DB",
  jpeg: "JPG",
  tiff: "TIF",
  appimage: "APP",
  json: "JSN",
  jsonc: "JSC",
  jsx: "JSX",
  mjs: "JS",
  cjs: "JS",
  tsx: "TSX",
  html: "HTM",
  scss: "SCS",
  sass: "SAS",
  bash: "SH",
  zsh: "SH",
  yaml: "YML",
  yml: "YML",
  gitignore: "GIT",
  editorconfig: "ED",
  lock: "LCK",
};

const FILENAME_LABEL_OVERRIDES: Record<string, string> = {
  readme: "TXT",
  license: "TXT",
  changelog: "LOG",
};

const EXTENSION_LABEL_CLASS_OVERRIDES: Record<string, string> = {
  txt: "theme-tc-ext-txt",
  md: "theme-tc-ext-md",
  markdown: "theme-tc-ext-md",
  doc: "theme-tc-ext-doc",
  docx: "theme-tc-ext-doc",
  odt: "theme-tc-ext-doc",
  pages: "theme-tc-ext-doc",
  rtf: "theme-tc-ext-doc",
  pdf: "theme-tc-ext-pdf",
  xls: "theme-tc-ext-xls",
  xlsx: "theme-tc-ext-xls",
  ods: "theme-tc-ext-xls",
  numbers: "theme-tc-ext-xls",
  ppt: "theme-tc-ext-ppt",
  pptx: "theme-tc-ext-ppt",
  odp: "theme-tc-ext-ppt",
  key: "theme-tc-ext-ppt",
  csv: "theme-tc-ext-csv",
  tsv: "theme-tc-ext-csv",
  sqlite: "theme-tc-ext-db",
  sqlite3: "theme-tc-ext-db",
  db: "theme-tc-ext-db",
  jpg: "theme-tc-ext-jpg",
  jpeg: "theme-tc-ext-jpg",
  png: "theme-tc-ext-png",
  gif: "theme-tc-ext-gif",
  svg: "theme-tc-ext-svg",
  webp: "theme-tc-ext-webp",
  bmp: "theme-tc-ext-image",
  ico: "theme-tc-ext-image",
  heic: "theme-tc-ext-image",
  avif: "theme-tc-ext-image",
  tif: "theme-tc-ext-image",
  tiff: "theme-tc-ext-image",
  zip: "theme-tc-ext-zip",
  rar: "theme-tc-ext-rar",
  "7z": "theme-tc-ext-7z",
  tar: "theme-tc-ext-tar",
  gz: "theme-tc-ext-tar",
  bz2: "theme-tc-ext-tar",
  xz: "theme-tc-ext-tar",
  tgz: "theme-tc-ext-tar",
  ts: "theme-tc-ext-ts",
  tsx: "theme-tc-ext-ts",
  js: "theme-tc-ext-js",
  jsx: "theme-tc-ext-js",
  mjs: "theme-tc-ext-js",
  cjs: "theme-tc-ext-js",
  json: "theme-tc-ext-json",
  jsonc: "theme-tc-ext-json",
  py: "theme-tc-ext-py",
  rs: "theme-tc-ext-rs",
  go: "theme-tc-ext-go",
  java: "theme-tc-ext-java",
  kt: "theme-tc-ext-java",
  rb: "theme-tc-ext-rb",
  php: "theme-tc-ext-php",
  swift: "theme-tc-ext-swift",
  c: "theme-tc-ext-c",
  cc: "theme-tc-ext-c",
  cpp: "theme-tc-ext-c",
  h: "theme-tc-ext-c",
  hpp: "theme-tc-ext-c",
  cs: "theme-tc-ext-cs",
  html: "theme-tc-ext-html",
  css: "theme-tc-ext-css",
  scss: "theme-tc-ext-css",
  sass: "theme-tc-ext-css",
  sql: "theme-tc-ext-sql",
  sh: "theme-tc-ext-shell",
  zsh: "theme-tc-ext-shell",
  bash: "theme-tc-ext-shell",
  env: "theme-tc-ext-env",
  gitignore: "theme-tc-ext-config",
  editorconfig: "theme-tc-ext-config",
  ini: "theme-tc-ext-config",
  cfg: "theme-tc-ext-config",
  conf: "theme-tc-ext-config",
  yaml: "theme-tc-ext-yaml",
  yml: "theme-tc-ext-yaml",
  toml: "theme-tc-ext-toml",
  lock: "theme-tc-ext-lock",
  mp3: "theme-tc-ext-mp3",
  wav: "theme-tc-ext-audio",
  flac: "theme-tc-ext-audio",
  aac: "theme-tc-ext-audio",
  ogg: "theme-tc-ext-audio",
  m4a: "theme-tc-ext-audio",
  mp4: "theme-tc-ext-mp4",
  mkv: "theme-tc-ext-video",
  mov: "theme-tc-ext-video",
  avi: "theme-tc-ext-video",
  webm: "theme-tc-ext-video",
  wmv: "theme-tc-ext-video",
  m4v: "theme-tc-ext-video",
  dmg: "theme-tc-ext-mac",
  pkg: "theme-tc-ext-mac",
  exe: "theme-tc-ext-win",
  msi: "theme-tc-ext-win",
  deb: "theme-tc-ext-linux",
  rpm: "theme-tc-ext-linux",
  apk: "theme-tc-ext-linux",
  appimage: "theme-tc-ext-linux",
  app: "theme-tc-ext-app",
  bin: "theme-tc-ext-bin",
};

const FILENAME_LABEL_CLASS_OVERRIDES: Record<string, string> = {
  readme: "theme-tc-ext-md",
  license: "theme-tc-ext-txt",
  changelog: "theme-tc-ext-txt",
};

const ARCHIVE_LABEL_SUFFIXES: Array<[suffix: string, label: string]> = [
  [".tar.gz", "TGZ"],
  [".tar.bz2", "TBZ"],
  [".tar.xz", "TXZ"],
];

const ARCHIVE_LABEL_SUFFIX_CLASSES: Array<[suffix: string, className: string]> = [
  [".tar.gz", "theme-tc-ext-tar"],
  [".tar.bz2", "theme-tc-ext-tar"],
  [".tar.xz", "theme-tc-ext-tar"],
];

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

const FILE_VISUALS: Record<
  FileVisualGroup,
  EntryVisual
> = {
  "file-document": {
    group: "file-document",
    slot: "tc-file-text",
    icon: FileText,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-text",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-text-file theme-tc-type-document",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-pdf": {
    group: "file-pdf",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-document",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-spreadsheet": {
    group: "file-spreadsheet",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-spreadsheet",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-presentation": {
    group: "file-presentation",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-presentation",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-data": {
    group: "file-data",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-data",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-image": {
    group: "file-image",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-image",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-archive": {
    group: "file-archive",
    slot: "tc-file-archive",
    icon: Archive,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-archive",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-archive-file",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-code": {
    group: "file-code",
    slot: "tc-file-text",
    icon: FileText,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-text",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-text-file theme-tc-type-code",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-config": {
    group: "file-config",
    slot: "tc-file-text",
    icon: FileText,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-text",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-text-file theme-tc-type-config",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-audio": {
    group: "file-audio",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-media",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-video": {
    group: "file-video",
    slot: "tc-file-associated",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-associated",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-associated-file theme-tc-type-media",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-installer": {
    group: "file-installer",
    slot: "tc-file-program",
    icon: Package,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-program",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-program-file",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-semibold",
  },
  "file-app": {
    group: "file-app",
    slot: "tc-file-program",
    icon: Package,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-program",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-program-file",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "font-medium",
  },
  "file-default": {
    group: "file-default",
    slot: "tc-file-standard",
    icon: File,
    iconSize: 12,
    iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-standard",
    iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-standard-file",
    nameClassName: "theme-tc-file-name",
    nameWeightClassName: "",
  },
};

const HIDDEN_FILE_VISUAL: EntryVisual = {
  group: "file-hidden",
  slot: "tc-file-hidden",
  icon: File,
  iconSize: 12,
  iconClassName: "theme-tc-file-glyph theme-tc-file-glyph-hidden",
  iconWrapperClassName: "theme-tc-icon-slot theme-tc-slot-standard-file theme-tc-slot-hidden-file",
  nameClassName: "theme-tc-hidden-name",
  nameWeightClassName: "font-medium",
  overlayClassName: "theme-tc-overlay-hidden",
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
