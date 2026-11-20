import { FileEntry, FileType } from "../../types/file";

const FILE_ENTRY_SELECTOR = "[data-entry-path]";

const isFileType = (value: string | undefined): value is FileType =>
  value === "file" || value === "directory" || value === "symlink";

export const getFileEntryDataAttributes = (entry: FileEntry, index: number) => ({
  "data-entry-index": index,
  "data-entry-path": entry.path,
  "data-entry-name": entry.name,
  "data-entry-kind": entry.kind,
  "data-entry-is-hidden": entry.isHidden ? "true" : "false",
});

export const findFileEntryElement = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest<HTMLElement>(FILE_ENTRY_SELECTOR);
};

export const getFileEntryIndex = (element: HTMLElement | null): number | null => {
  const index = element?.dataset.entryIndex;
  if (!index) {
    return null;
  }

  const parsedIndex = Number(index);
  return Number.isFinite(parsedIndex) ? parsedIndex : null;
};

// 펼친 하위 항목은 패널 files에 없고 화면 DOM에만 있으므로, 경로로 DOM에서 항목을 찾는다.
export const findFileEntryByPath = (path: string): FileEntry | null => {
  const normalizedPath = path.normalize("NFC");
  const elements = document.querySelectorAll<HTMLElement>(FILE_ENTRY_SELECTOR);
  for (const element of Array.from(elements)) {
    if (element.dataset.entryPath?.normalize("NFC") === normalizedPath) {
      return readFileEntryFromElement(element);
    }
  }
  return null;
};

export const readFileEntryFromElement = (element: HTMLElement | null): FileEntry | null => {
  if (!element) {
    return null;
  }

  const { entryPath, entryName, entryKind, entryIsHidden } = element.dataset;
  if (!entryPath || !isFileType(entryKind)) {
    return null;
  }

  return {
    name: entryName || "",
    path: entryPath,
    kind: entryKind,
    isHidden: entryIsHidden === "true",
  };
};
