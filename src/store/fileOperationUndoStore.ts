import { create } from "zustand";
import { joinPath } from "../utils/path";

export type FileOperationUndoKind = "rename" | "move";

export interface FileOperationUndoEntry {
  originalPath: string;
  currentPath: string;
}

export interface FileOperationUndoOperation {
  id: string;
  kind: FileOperationUndoKind;
  entries: FileOperationUndoEntry[];
  createdAt: number;
}

interface FileOperationUndoState {
  lastOperation: FileOperationUndoOperation | null;
  pendingMoveOperations: Record<string, FileOperationUndoOperation>;
  recordRenameUndo: (originalPath: string, currentPath: string) => void;
  registerPendingMoveUndo: (
    jobId: string,
    entries: FileOperationUndoEntry[]
  ) => void;
  completePendingMoveUndo: (jobId: string) => void;
  discardPendingMoveUndo: (jobId: string) => void;
  clearLastOperation: () => void;
}

let undoSequence = 0;

const normalizeUndoPath = (path: string) => {
  const normalized = path.normalize("NFC").replace(/\\/g, "/");
  const driveRootMatch = normalized.match(/^([A-Z]:)\/?$/);

  if (driveRootMatch) {
    return `${driveRootMatch[1]}/`;
  }

  if (normalized === "/") {
    return "/";
  }

  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
};

const areUndoPathsEquivalent = (left: string, right: string) =>
  normalizeUndoPath(left) === normalizeUndoPath(right);

export const getUndoPathBaseName = (path: string) => {
  const normalized = path.replace(/[\\/]+$/, "") || path;
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : normalized;
};

const createOperation = (
  kind: FileOperationUndoKind,
  entries: FileOperationUndoEntry[]
): FileOperationUndoOperation | null => {
  const usableEntries = entries.filter(
    (entry) =>
      entry.originalPath.length > 0 &&
      entry.currentPath.length > 0 &&
      !areUndoPathsEquivalent(entry.originalPath, entry.currentPath)
  );

  if (usableEntries.length === 0) {
    return null;
  }

  undoSequence += 1;
  return {
    id: `${kind}-${Date.now()}-${undoSequence}`,
    kind,
    entries: usableEntries,
    createdAt: Date.now(),
  };
};

export const buildMoveUndoEntries = (
  sourcePaths: string[],
  targetPath: string,
  options: { targetIsDirectory: boolean }
): FileOperationUndoEntry[] => {
  if (sourcePaths.length === 0 || targetPath.length === 0) {
    return [];
  }

  const targetIsDirectory = options.targetIsDirectory || sourcePaths.length > 1;

  return sourcePaths.map((sourcePath) => ({
    originalPath: sourcePath,
    currentPath: targetIsDirectory
      ? joinPath(targetPath, getUndoPathBaseName(sourcePath))
      : targetPath,
  }));
};

export const getFileOperationUndoSubtitle = (
  operation: FileOperationUndoOperation | null
) => {
  if (!operation) {
    return "No rename or move to undo";
  }

  const firstEntry = operation.entries[0];
  if (!firstEntry) {
    return "No rename or move to undo";
  }

  if (operation.kind === "rename") {
    return `Rename ${getUndoPathBaseName(firstEntry.currentPath)} back to ${getUndoPathBaseName(
      firstEntry.originalPath
    )}`;
  }

  if (operation.entries.length === 1) {
    return `Move ${getUndoPathBaseName(firstEntry.currentPath)} back`;
  }

  return `Move ${operation.entries.length} items back`;
};

export const useFileOperationUndoStore = create<FileOperationUndoState>((set) => ({
  lastOperation: null,
  pendingMoveOperations: {},

  recordRenameUndo: (originalPath, currentPath) =>
    set((state) => {
      const operation = createOperation("rename", [{ originalPath, currentPath }]);
      return operation ? { lastOperation: operation } : state;
    }),

  registerPendingMoveUndo: (jobId, entries) =>
    set((state) => {
      if (!jobId.trim()) {
        return state;
      }

      const operation = createOperation("move", entries);
      if (!operation) {
        return state;
      }

      return {
        pendingMoveOperations: {
          ...state.pendingMoveOperations,
          [jobId]: operation,
        },
      };
    }),

  completePendingMoveUndo: (jobId) =>
    set((state) => {
      const operation = state.pendingMoveOperations[jobId];
      if (!operation) {
        return state;
      }

      const { [jobId]: _completed, ...remaining } = state.pendingMoveOperations;
      return {
        lastOperation: operation,
        pendingMoveOperations: remaining,
      };
    }),

  discardPendingMoveUndo: (jobId) =>
    set((state) => {
      if (!state.pendingMoveOperations[jobId]) {
        return state;
      }

      const { [jobId]: _discarded, ...remaining } = state.pendingMoveOperations;
      return { pendingMoveOperations: remaining };
    }),

  clearLastOperation: () => set({ lastOperation: null }),
}));
