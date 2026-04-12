import { FileEntry, FileType, PanelState } from "../types/file";
import { joinPath } from "../utils/path";

export type PanelId = "left" | "right";
export type MultiRenameCaseMode = "keep" | "upper" | "lower" | "title";

export interface MultiRenameItem {
  path: string;
  name: string;
  kind: FileType;
  lastModified?: number | null;
}

export interface MultiRenameSession {
  panelId: PanelId;
  directoryPath: string;
  items: MultiRenameItem[];
  siblingNames: string[];
}

export interface MultiRenameOptions {
  nameMask: string;
  extensionMask: string;
  searchText: string;
  replaceText: string;
  caseMode: MultiRenameCaseMode;
  counterStart: number;
  counterStep: number;
  counterPadding: number;
}

export interface BatchRenameOperation {
  oldPath: string;
  newPath: string;
}

export interface MultiRenamePreviewRow extends BatchRenameOperation {
  oldName: string;
  newName: string;
  changed: boolean;
  error: string | null;
}

export const defaultMultiRenameOptions: MultiRenameOptions = {
  nameMask: "[N]",
  extensionMask: "[E]",
  searchText: "",
  replaceText: "",
  caseMode: "keep",
  counterStart: 1,
  counterStep: 1,
  counterPadding: 0,
};

const getCursorCandidate = (panel: PanelState): FileEntry | null => {
  const cursorEntry = panel.files[panel.cursorIndex];
  if (!cursorEntry || cursorEntry.name === "..") {
    return null;
  }

  return cursorEntry;
};

const splitNameExtension = (name: string, kind: FileType) => {
  if (kind === "directory") {
    return { baseName: name, extension: "" };
  }

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { baseName: name, extension: "" };
  }

  return {
    baseName: name.slice(0, dotIndex),
    extension: name.slice(dotIndex + 1),
  };
};

const applySearchReplace = (value: string, searchText: string, replaceText: string) => {
  if (!searchText) {
    return value;
  }

  return value.split(searchText).join(replaceText);
};

const applyCaseMode = (value: string, caseMode: MultiRenameCaseMode) => {
  switch (caseMode) {
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "title":
      return value
        .toLowerCase()
        .replace(/(^|[\s._-])([^\s._-])/g, (_match, prefix: string, char: string) => {
          return `${prefix}${char.toUpperCase()}`;
        });
    case "keep":
    default:
      return value;
  }
};

const formatCounter = (value: number, padding: number) => {
  const absValue = Math.abs(Math.trunc(value));
  const padded = absValue.toString().padStart(Math.max(0, Math.trunc(padding)), "0");
  return value < 0 ? `-${padded}` : padded;
};

const renderMask = (
  template: string,
  context: {
    baseName: string;
    extension: string;
    counter: string;
  }
) =>
  template.replace(/\[(N|E|C)\]/g, (_match, token: string) => {
    switch (token) {
      case "N":
        return context.baseName;
      case "E":
        return context.extension;
      case "C":
        return context.counter;
      default:
        return "";
    }
  });

export const buildMultiRenameSession = (
  panelId: PanelId,
  panel: PanelState
): MultiRenameSession => {
  const visibleEntries = panel.files.filter((entry) => entry.name !== "..");
  const selectedEntries =
    panel.selectedItems.size > 0
      ? visibleEntries.filter((entry) => panel.selectedItems.has(entry.path))
      : [];
  const items = selectedEntries.length > 0 ? selectedEntries : [getCursorCandidate(panel)].filter(
    (entry): entry is FileEntry => entry !== null
  );

  return {
    panelId,
    directoryPath: panel.currentPath,
    items: items.map((entry) => ({
      path: entry.path,
      name: entry.name,
      kind: entry.kind,
      lastModified: entry.lastModified,
    })),
    siblingNames: visibleEntries.map((entry) => entry.name),
  };
};

export const buildMultiRenamePreview = (
  session: MultiRenameSession,
  options: MultiRenameOptions
): MultiRenamePreviewRow[] => {
  const selectedNames = new Set(session.items.map((item) => item.name));
  const siblingNames = new Set(
    session.siblingNames.filter((name) => !selectedNames.has(name))
  );

  const previewRows = session.items.map((item, index) => {
    const { baseName, extension } = splitNameExtension(item.name, item.kind);
    const counterValue = options.counterStart + options.counterStep * index;
    const counter = formatCounter(counterValue, options.counterPadding);
    const maskedName = renderMask(options.nameMask, { baseName, extension, counter });
    const maskedExtension =
      item.kind === "directory"
        ? ""
        : renderMask(options.extensionMask, { baseName, extension, counter });
    const nextNamePart = applyCaseMode(
      applySearchReplace(maskedName, options.searchText, options.replaceText),
      options.caseMode
    );
    const nextExtensionPart = applyCaseMode(
      applySearchReplace(maskedExtension, options.searchText, options.replaceText),
      options.caseMode
    );
    const newName =
      item.kind === "directory" || nextExtensionPart.length === 0
        ? nextNamePart
        : `${nextNamePart}.${nextExtensionPart}`;

    return {
      oldPath: item.path,
      newPath: joinPath(session.directoryPath, newName),
      oldName: item.name,
      newName,
      changed: item.name !== newName,
      error: null,
    };
  });

  const duplicateCounts = previewRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.newName] = (counts[row.newName] ?? 0) + 1;
    return counts;
  }, {});

  return previewRows.map((row) => {
    let error: string | null = null;

    if (!row.newName.trim()) {
      error = "새 이름이 비어 있습니다.";
    } else if (/[\\/]/.test(row.newName)) {
      error = "이름에 경로 구분자를 포함할 수 없습니다.";
    } else if ((duplicateCounts[row.newName] ?? 0) > 1) {
      error = "같은 이름이 둘 이상 생성됩니다.";
    } else if (row.newName !== row.oldName && siblingNames.has(row.newName)) {
      error = "같은 폴더에 이미 같은 이름이 있습니다.";
    }

    return {
      ...row,
      error,
    };
  });
};

export const getBatchRenameOperations = (previewRows: MultiRenamePreviewRow[]) =>
  previewRows
    .filter((row) => row.changed && row.error === null)
    .map<BatchRenameOperation>((row) => ({
      oldPath: row.oldPath,
      newPath: row.newPath,
    }));
