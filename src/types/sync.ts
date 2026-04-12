export type SyncStatus = "LeftOnly" | "RightOnly" | "LeftNewer" | "RightNewer" | "Same";
export type SyncDirection = "toRight" | "toLeft" | "skip";

export interface SyncItem {
  relPath: string;
  leftPath: string | null;
  rightPath: string | null;
  status: SyncStatus;
  direction: SyncDirection;
}
