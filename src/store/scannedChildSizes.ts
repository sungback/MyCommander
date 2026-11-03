import { usePanelStore } from "./panelStore";
import type { ScannedChildDirectorySize } from "../types/file";
import { recordHasHardLinks } from "./panelStoreFileHelpers";

interface ScanResultWithChildren {
  children?: ScannedChildDirectorySize[];
  hasHardLinks?: boolean;
  startedAtMs?: number;
}

/**
 * 정확 계산 결과에 함께 온 하위 폴더 크기를 패널 크기 캐시에 반영한다.
 * 정확 계산을 받는 곳(백그라운드 계산, 수동 계산, 정보 다이얼로그)은 모두 이 함수를 거친다.
 */
export const recordScannedChildSizes = (result: ScanResultWithChildren, rootPath?: string) => {
  if (rootPath !== undefined && result.hasHardLinks !== undefined) {
    recordHasHardLinks(rootPath, result.hasHardLinks);
  }
  const children = result.children ?? [];
  for (const child of children) {
    recordHasHardLinks(child.path, child.hasHardLinks);
  }
  if (children.length === 0) {
    return;
  }

  const scanStartedAt =
    typeof result.startedAtMs === "number" && Number.isFinite(result.startedAtMs)
      ? result.startedAtMs
      : Date.now();
  usePanelStore.getState().applyScannedChildSizes(children, scanStartedAt);
};
