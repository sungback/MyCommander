import type { FileEntry } from "../../../types/file";
import type { SyncDirection, SyncItem, SyncStatus } from "../../../types/sync";
import { getPanelAccessPath } from "../../../utils/panelPath";

export { getPanelAccessPath };

export type SyncStage = "paths" | "analyzing" | "results" | "executing";

export type SyncExecutionFailure = {
  relPath: string;
  message: string;
};

const MAX_FAILURES_TO_SHOW = 3;

export const formatSyncExecutionFailures = (
  failures: SyncExecutionFailure[]
) => {
  const visibleFailures = failures.slice(0, MAX_FAILURES_TO_SHOW);
  const failureDetails = visibleFailures
    .map((failure) => `${failure.relPath} (${failure.message})`)
    .join(", ");
  const hiddenFailureCount = failures.length - visibleFailures.length;
  const hiddenFailureSuffix =
    hiddenFailureCount > 0 ? `, and ${hiddenFailureCount} more` : "";
  const itemLabel = failures.length === 1 ? "item" : "items";

  return `${failures.length} ${itemLabel} failed to synchronize: ${failureDetails}${hiddenFailureSuffix}.`;
};

export const updateSyncItemDirection = (
  items: SyncItem[],
  index: number,
  direction: SyncDirection
) =>
  items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, direction } : item
  );

export const selectAllPendingSyncItems = (
  items: SyncItem[],
  targetDirection: Exclude<SyncDirection, "skip">
) =>
  items.map((item) => ({
    ...item,
    direction: item.direction === "skip" ? targetDirection : item.direction,
  }));

export const excludeSameSyncItems = (items: SyncItem[]) =>
  items.map((item) => ({
    ...item,
    direction:
      item.status === "Same" && item.direction !== "skip"
        ? "skip"
        : item.direction,
  }));

// 차이가 있는 항목(Same 제외)의 최상위 이름. 하위 폴더 안의 차이는 그 폴더 이름으로 모은다.
export const getDifferingTopLevelNames = (items: SyncItem[]): Set<string> => {
  const names = new Set<string>();
  for (const item of items) {
    if (item.status === "Same") {
      continue;
    }
    const topLevelName = item.relPath.split(/[\\/]/)[0];
    if (topLevelName) {
      names.add(topLevelName.normalize("NFC"));
    }
  }
  return names;
};

// 패널 목록(루트 항목)에서 이름이 일치하는 항목의 경로. NFC/NFD 차이는 무시한다.
export const pickPanelPathsByName = (files: FileEntry[], names: Set<string>): string[] =>
  files
    .filter((file) => file.name !== ".." && names.has(file.name.normalize("NFC")))
    .map((file) => file.path);

export const getStatusColor = (status: SyncStatus): string => {
  switch (status) {
    case "LeftOnly":
      return "text-blue-400";
    case "RightOnly":
      return "text-green-400";
    case "LeftNewer":
      return "text-yellow-400";
    case "RightNewer":
      return "text-orange-400";
    case "Same":
      return "text-gray-400";
    default:
      return "text-text-secondary";
  }
};

export const getStatusLabel = (status: SyncStatus): string => {
  switch (status) {
    case "LeftOnly":
      return "Left Only";
    case "RightOnly":
      return "Right Only";
    case "LeftNewer":
      return "Left Newer";
    case "RightNewer":
      return "Right Newer";
    case "Same":
      return "Same";
    default:
      return status;
  }
};
