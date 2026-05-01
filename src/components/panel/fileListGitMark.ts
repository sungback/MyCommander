import type { GitStatus } from "../../store/gitStatusStore";
import type { FileEntry } from "../../types/file";

export const getGitMarkForEntry = (
  entry: FileEntry,
  gitStatus: GitStatus | null
): string | undefined => {
  if (!gitStatus) return undefined;

  if (entry.kind === "directory") {
    const childPrefix = `${entry.name}/`;
    const hasChanges =
      gitStatus.modified.some((path) => path.startsWith(childPrefix)) ||
      gitStatus.added.some((path) => path.startsWith(childPrefix)) ||
      gitStatus.deleted.some((path) => path.startsWith(childPrefix)) ||
      gitStatus.untracked.some((path) => path.startsWith(childPrefix));

    return hasChanges ? "~" : undefined;
  }

  if (gitStatus.modified.includes(entry.name)) return "M";
  if (gitStatus.added.includes(entry.name)) return "A";
  if (gitStatus.deleted.includes(entry.name)) return "D";
  if (gitStatus.untracked.includes(entry.name)) return "?";

  return undefined;
};
