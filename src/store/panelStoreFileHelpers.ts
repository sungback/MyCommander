import { queuePersistentSizeCacheUpsert } from "./directorySizeCachePersistence";
import { normalizePathKey } from "../utils/panelHelpers";
import type { ConfirmedDirectorySizeStatus, DirectorySizeStatus } from "../types/file";

type StableDirectorySizeStatus = Extract<
  DirectorySizeStatus,
  "estimated" | "partial" | "exact" | "limited"
>;

export const shouldCacheSizeStatus = (status: unknown) =>
  status === "estimated" || status === "partial" || isConfirmedSizeStatus(status);

// 끝까지 계산이 끝난 값(exact, limited)인지 확인한다. 재검증·조상 무효화 규칙은 두 상태가 같다.
export const isConfirmedSizeStatus = (
  status: unknown
): status is ConfirmedDirectorySizeStatus => status === "exact" || status === "limited";

export const isLikelyHeavySystemPath = (path: string) => {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();

  return (
    normalized.endsWith("/users") ||
    normalized.endsWith("/windows") ||
    normalized.endsWith("/program files") ||
    normalized.endsWith("/program files (x86)") ||
    normalized.endsWith("/system") ||
    normalized.endsWith("/usr")
  );
};

export const toHydratedStatus = (
  status: StableDirectorySizeStatus,
  isStale: boolean,
  path: string
) => {
  const resolved = isStale && isConfirmedSizeStatus(status) ? "estimated" : status;
  if (resolved === "partial" && isLikelyHeavySystemPath(path)) {
    return "estimated";
  }
  return resolved;
};

// 경로별로 크기를 마지막으로 계산한 시각. 툴팁에서 "N일 전 계산"을 보여 주는 데 쓴다.
const sizeScannedAtByPath = new Map<string, number>();

export const recordSizeScannedAt = (path: string, scannedAt: number) => {
  sizeScannedAtByPath.set(normalizePathKey(path), scannedAt);
};

export const getSizeScannedAt = (path: string) =>
  sizeScannedAtByPath.get(normalizePathKey(path));

// scannedAt: 값이 계산된 시각. 하위 폴더 결과처럼 상위 스캔에서 구한 값은 그 스캔의 시작 시각을 넘긴다.
// touchLastUsed: false면 최근 사용 시각을 바꾸지 않는다. 사용자가 열지 않은 하위 폴더 결과가
// 디스크 캐시 정리(최근 사용 순) 때 실제로 쓰던 항목을 밀어내지 않게 한다.
export const queueStableSizeCacheWrite = (
  path: string,
  size: number,
  status: StableDirectorySizeStatus,
  scannedAt: number = Date.now(),
  touchLastUsed = true
) => {
  recordSizeScannedAt(path, scannedAt);
  queuePersistentSizeCacheUpsert({
    path: normalizePathKey(path),
    size,
    status,
    scannedAt,
    ...(touchLastUsed ? { lastUsedAt: Date.now() } : {}),
  });
};

// 이번 앱 세션에서 실제 디스크 스캔으로 다시 확인한 디렉터리 경로.
// 영속 캐시에서 복원된 exact 값은 외부 변경(cargo clean 등)을 반영하지 못할 수 있어 세션당 한 번 재검증한다.
const sessionVerifiedSizePaths = new Set<string>();

export const markSizeVerifiedThisSession = (path: string) => {
  sessionVerifiedSizePaths.add(normalizePathKey(path));
};

export const isSizeVerifiedThisSession = (path: string) =>
  sessionVerifiedSizePaths.has(normalizePathKey(path));

export const __resetSessionVerifiedSizesForTests = () => {
  sessionVerifiedSizePaths.clear();
  progressBaselines.clear();
  sizeChangeTimes.clear();
  sizeScannedAtByPath.clear();
};

// 파일 감시가 마지막으로 알려 준 변경 시각. 정확 스캔 중에 생긴 변경을 스캔 완료 시 놓치지 않기 위해 쓴다.
const MAX_TRACKED_SIZE_CHANGES = 2_000;
const sizeChangeTimes = new Map<string, number>();

export const recordSizeChange = (path: string, at: number = Date.now()) => {
  const key = normalizePathKey(path);
  // 삽입 순서를 갱신해 오래된 항목부터 버린다.
  sizeChangeTimes.delete(key);
  sizeChangeTimes.set(key, at);

  if (sizeChangeTimes.size > MAX_TRACKED_SIZE_CHANGES) {
    const oldest = sizeChangeTimes.keys().next().value;
    if (oldest !== undefined) {
      sizeChangeTimes.delete(oldest);
    }
  }
};

export const hasSizeChangedSince = (path: string, since: number) => {
  const changedAt = sizeChangeTimes.get(normalizePathKey(path));
  return changedAt !== undefined && changedAt >= since;
};

// 스캔 진행 이벤트가 sizeCache를 덮어쓰기 전의 값. 최종 exact 값과 비교해 크기 변화를 감지한다.
interface SizeBaseline {
  size: number;
  wasExact: boolean;
}

const progressBaselines = new Map<string, SizeBaseline>();

export const rememberSizeBaseline = (path: string, baseline: SizeBaseline) => {
  const key = normalizePathKey(path);
  if (!progressBaselines.has(key)) {
    progressBaselines.set(key, baseline);
  }
};

export const takeSizeBaseline = (path: string) => {
  const key = normalizePathKey(path);
  const baseline = progressBaselines.get(key);
  progressBaselines.delete(key);
  return baseline;
};
