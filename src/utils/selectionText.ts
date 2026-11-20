import type { FileEntry } from "../types/file";
import { formatDate } from "./format";

export type SelectionClipboardMode = "names" | "paths" | "details" | "pathDetails";

// 마지막 점 뒤를 확장자로 본다. 숨김 파일(.gitignore)처럼 점이 맨 앞이면 확장자가 없다.
export const getFileExtension = (name: string): string => {
  const normalized = name.normalize("NFC");
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return "";
  }
  return normalized.slice(dotIndex + 1).toLowerCase();
};

export const getPathBaseName = (path: string): string => {
  const trimmed = path.replace(/[\\/]+$/, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index >= 0 ? trimmed.slice(index + 1) : trimmed;
};

// 커서 파일과 확장자가 같은 파일(폴더 제외)의 경로를 돌려준다. 커서가 폴더이면 null.
export const findSameExtensionPaths = (
  files: FileEntry[],
  cursorEntry: FileEntry | undefined
): { extension: string; paths: string[] } | null => {
  if (!cursorEntry || cursorEntry.name === ".." || cursorEntry.kind === "directory") {
    return null;
  }

  const extension = getFileExtension(cursorEntry.name);
  const paths = files
    .filter(
      (file) =>
        file.name !== ".." &&
        file.kind !== "directory" &&
        getFileExtension(file.name) === extension
    )
    .map((file) => file.path);

  return { extension, paths };
};

// 선택 경로를 목록 순서대로 정렬한다. 펼친 하위 항목처럼 files에 없는 경로는 뒤에 붙인다.
export const orderPathsByFiles = (files: FileEntry[], paths: string[]): string[] => {
  const wanted = new Set(paths);
  const ordered = files.filter((file) => wanted.has(file.path)).map((file) => file.path);
  const known = new Set(ordered);
  return [...ordered, ...paths.filter((path) => !known.has(path))];
};

const formatDetailsLine = (entry: FileEntry | undefined, fallbackName: string): string => {
  if (!entry) {
    return fallbackName;
  }
  const size = entry.kind === "directory" ? "<DIR>" : String(entry.size ?? "");
  const extension = entry.kind === "directory" ? "" : getFileExtension(entry.name);
  return [entry.name, extension, size, formatDate(entry.lastModified)].join("\t");
};

export const formatSelectionForClipboard = (
  files: FileEntry[],
  paths: string[],
  mode: SelectionClipboardMode
): string => {
  const entryByPath = new Map(files.map((file) => [file.path, file]));

  return orderPathsByFiles(files, paths)
    .map((path) => {
      const entry = entryByPath.get(path);
      const name = entry?.name ?? getPathBaseName(path);
      switch (mode) {
        case "names":
          return name;
        case "paths":
          return path;
        case "details":
          return formatDetailsLine(entry, name);
        case "pathDetails":
          return `${path}\t${formatDetailsLine(entry, name).split("\t").slice(1).join("\t")}`;
      }
    })
    .join("\n");
};

export const serializeSelectionFile = (paths: string[]): string => paths.join("\n") + "\n";

// 파일에서 불러온 줄을 현재 목록의 경로와 맞춘다. 전체 경로가 같거나 이름이 같으면 선택한다.
export const matchSelectionLines = (files: FileEntry[], text: string): string[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().normalize("NFC"))
    .filter((line) => line.length > 0);
  const lineSet = new Set(lines);
  const nameSet = new Set(lines.map(getPathBaseName));

  return files
    .filter(
      (file) =>
        file.name !== ".." &&
        (lineSet.has(file.path.normalize("NFC")) || nameSet.has(file.name.normalize("NFC")))
    )
    .map((file) => file.path);
};
