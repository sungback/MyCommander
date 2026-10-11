import { normalizePathKey } from "../../../utils/panelHelpers";
import type { StorageKind } from "../../../hooks/tauriCommands/fileCommands";

// 이름만 보면 클라우드 같지만 실제로는 일반 로컬 폴더로 확인된 경로(루트).
const verifiedLocalRoots = new Set<string>();
// 이미 백엔드에 물어본 경로. 같은 경로를 반복해서 묻지 않는다.
const requestedPaths = new Set<string>();

const trimTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;

export const hasRequestedStorageKind = (path: string) =>
  requestedPaths.has(trimTrailingSlash(normalizePathKey(path)));

export const markStorageKindRequested = (path: string) => {
  requestedPaths.add(trimTrailingSlash(normalizePathKey(path)));
};

/** 판정 결과를 기록하고, 새로 로컬로 확인되어 판정이 바뀌었으면 true를 반환한다. */
export const recordStorageKind = (path: string, kind: StorageKind) => {
  if (kind !== "local") {
    return false;
  }

  const key = trimTrailingSlash(normalizePathKey(path));
  if (verifiedLocalRoots.has(key)) {
    return false;
  }

  verifiedLocalRoots.add(key);
  return true;
};

/**
 * 경로가 로컬로 확인된 루트 아래에 있으면 그 루트 이후의 상대 경로를, 아니면 null을 반환한다.
 * 루트 이후 구간에 클라우드 이름이 다시 나타나는 경우를 구분하기 위해 쓴다.
 */
export const getPathBelowVerifiedLocalRoot = (path: string) => {
  if (verifiedLocalRoots.size === 0) {
    return null;
  }

  const key = trimTrailingSlash(normalizePathKey(path));
  let longestRoot: string | null = null;

  for (const root of verifiedLocalRoots) {
    if (
      (key === root || key.startsWith(`${root}/`)) &&
      (longestRoot === null || root.length > longestRoot.length)
    ) {
      longestRoot = root;
    }
  }

  return longestRoot === null ? null : key.slice(longestRoot.length);
};

export const __resetStorageClassificationForTests = () => {
  verifiedLocalRoots.clear();
  requestedPaths.clear();
};
