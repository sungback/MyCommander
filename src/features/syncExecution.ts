import { SyncDirection, SyncEntryKind, SyncItem, SyncStatus } from "../types/sync";
import { joinPath } from "../utils/path";

export interface SyncExecutionOperation {
  direction: Exclude<SyncDirection, "skip">;
  relPath: string;
  sourcePath: string;
  sourceKind: SyncEntryKind;
  targetPath: string;
  status: SyncStatus;
}

const normalizeRelativePath = (path: string): string =>
  path.normalize("NFC").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

const isDescendantRelativePath = (ancestor: string, candidate: string): boolean => {
  const normalizedAncestor = normalizeRelativePath(ancestor);
  const normalizedCandidate = normalizeRelativePath(candidate);

  if (!normalizedAncestor || normalizedAncestor === normalizedCandidate) {
    return false;
  }

  return normalizedCandidate.startsWith(`${normalizedAncestor}/`);
};

const isActionableDirectory = (status: SyncStatus): boolean =>
  status === "LeftOnly" || status === "RightOnly";

export const buildSyncExecutionOperations = (
  syncItems: SyncItem[],
  leftRoot: string,
  rightRoot: string
): SyncExecutionOperation[] => {
  const candidateOperations = syncItems.flatMap<SyncExecutionOperation>((item) => {
    if (item.direction === "skip") {
      return [];
    }

    const direction = item.direction as Exclude<SyncDirection, "skip">;
    const sourcePath = direction === "toRight" ? item.leftPath : item.rightPath;
    const sourceKind = direction === "toRight" ? item.leftKind : item.rightKind;
    const targetRoot = direction === "toRight" ? rightRoot : leftRoot;

    if (!sourcePath || !sourceKind) {
      return [];
    }

    if (sourceKind === "directory" && !isActionableDirectory(item.status)) {
      return [];
    }

    return [
      {
        direction,
        relPath: item.relPath,
        sourcePath,
        sourceKind,
        targetPath: joinPath(targetRoot, item.relPath),
        status: item.status,
      },
    ];
  });

  return candidateOperations.filter((operation) => {
    return !candidateOperations.some(
      (candidate) =>
        candidate !== operation &&
        candidate.direction === operation.direction &&
        candidate.sourceKind === "directory" &&
        isDescendantRelativePath(candidate.relPath, operation.relPath)
    );
  });
};
