export type SyncStatus = "LeftOnly" | "RightOnly" | "LeftNewer" | "RightNewer" | "Same";
export type SyncDirection = "toRight" | "toLeft" | "skip";
export type SyncEntryKind = "file" | "directory";

export interface SyncItem {
  relPath: string;
  leftPath: string | null;
  rightPath: string | null;
  leftKind: SyncEntryKind | null;
  rightKind: SyncEntryKind | null;
  status: SyncStatus;
  direction: SyncDirection;
}
