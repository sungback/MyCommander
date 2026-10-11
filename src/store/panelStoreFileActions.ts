import {
  collectAncestorPaths,
  collectEntrySizeInvalidationPaths,
  collectNoiseFilteredSizeStalePaths,
  getPanelKey,
  invalidateEntrySizesAcrossPanels,
  setPanelFiles,
  sortPanelByField,
  updateEntrySizeAcrossPanels,
  updateEntrySizeStatusAcrossPanels,
} from "./panelStoreReducers";
import { persistPanelUpdate } from "./panelStorePersistence";
import {
  dropPendingPersistentSizeCacheUpserts,
  queuePersistentSizeCacheDelete,
} from "./directorySizeCachePersistence";
import {
  panelUpdate,
  type PanelStoreActions,
  type PanelStoreSet,
} from "./panelStoreActionTypes";
import { normalizePathKey } from "../utils/panelHelpers";
import type { DirectorySizeStatus } from "../types/file";
import {
  shouldCacheSizeStatus,
  toHydratedStatus,
  queueStableSizeCacheWrite,
  recordSizeScannedAt,
  hasSizeChangedSince,
  markSizeVerifiedThisSession,
  recordSizeChange,
  rememberSizeBaseline,
  takeSizeBaseline,
} from "./panelStoreFileHelpers";

type FileActions = Pick<
  PanelStoreActions,
  | "invalidateEntrySizes"
  | "markEntrySizesStale"
  | "setEntrySizeStatus"
  | "setFiles"
  | "setSort"
  | "updateEntrySize"
  | "updateEntrySizeEstimate"
  | "updateEntrySizeProgress"
  | "hydrateEntrySizesFromCache"
>;

export const createPanelStoreFileActions = (set: PanelStoreSet): FileActions => ({
  setFiles: (panel, files) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = setPanelFiles(
        state[panelKey],
        files,
        state.sizeCache,
        state.sizeStatusCache
      );

      return panelUpdate(panelKey, nextPanelState);
    }),

  setSort: (panel, field) =>
    set((state) => {
      const panelKey = getPanelKey(panel);
      const nextPanelState = sortPanelByField(state[panelKey], field);

      persistPanelUpdate(state, panel, nextPanelState);

      return {
        [panelKey]: nextPanelState,
      };
    }),

  updateEntrySize: (_panel, path, size, scanStartedAt) => {
    queueStableSizeCacheWrite(path, size, "exact");
    markSizeVerifiedThisSession(path);

    return set((state) => {
      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "exact"
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const cachedStale = state.sizeCacheStale[nextPanels.normalizedPath];
      // 스캔 도중 외부 변경이 감지됐다면 이 결과는 이미 낡았을 수 있으므로 stale을 유지해 다시 계산한다.
      const changedDuringScan =
        scanStartedAt !== undefined && hasSizeChangedSince(path, scanStartedAt);

      // 이전에 exact였던 값이 달라졌다면 조상 폴더의 exact 캐시도 더 이상 믿을 수 없다.
      const baseline =
        takeSizeBaseline(path) ??
        (cachedSize === undefined
          ? undefined
          : { size: cachedSize, wasExact: cachedStatus === "exact" || Boolean(cachedStale) });
      const staleAncestors =
        baseline?.wasExact && baseline.size !== size
          ? collectAncestorPaths(path).filter(
              (ancestor) =>
                state.sizeStatusCache[ancestor] === "exact" &&
                state.sizeCache[ancestor] !== undefined
            )
          : [];

      if (
        staleAncestors.length === 0 &&
        cachedSize === size &&
        cachedStatus === "exact" &&
        !cachedStale &&
        !changedDuringScan &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      let leftPanel = nextPanels.leftPanel;
      let rightPanel = nextPanels.rightPanel;
      const nextSizeStatusCache: Record<string, DirectorySizeStatus> = {
        ...state.sizeStatusCache,
        [nextPanels.normalizedPath]: "exact",
      };
      const nextSizeCacheStale = {
        ...state.sizeCacheStale,
        ...(changedDuringScan
          ? { [nextPanels.normalizedPath]: true }
          : cachedStale
            ? { [nextPanels.normalizedPath]: false }
            : {}),
      };

      for (const ancestor of staleAncestors) {
        const ancestorPanels = updateEntrySizeAcrossPanels(
          leftPanel,
          rightPanel,
          ancestor,
          state.sizeCache[ancestor],
          "estimated"
        );
        leftPanel = ancestorPanels.leftPanel;
        rightPanel = ancestorPanels.rightPanel;
        nextSizeStatusCache[ancestor] = "estimated";
        nextSizeCacheStale[ancestor] = true;
      }

      if (staleAncestors.length > 0) {
        queuePersistentSizeCacheDelete(staleAncestors);
      }

      return {
        sizeStatusCache: nextSizeStatusCache,
        sizeCacheStale: nextSizeCacheStale,
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        leftPanel,
        rightPanel,
      };
    });
  },

  updateEntrySizeEstimate: (_panel, path, size, status) => {
    takeSizeBaseline(path);

    return set((state) => {
      const key = normalizePathKey(path);
      const existingSize = state.sizeCache[key];
      // 이미 확인된 정확한 값을 빠른 추정값이 덮어쓰지 않는다(시작 직후 복원값과 추정이 경합할 수 있다).
      if (
        status === "estimated" &&
        existingSize !== undefined &&
        state.sizeStatusCache[key] === "exact" &&
        !state.sizeCacheStale[key]
      ) {
        const restored = updateEntrySizeAcrossPanels(
          state.leftPanel,
          state.rightPanel,
          path,
          existingSize,
          "exact"
        );

        return restored.leftPanel === state.leftPanel &&
          restored.rightPanel === state.rightPanel
          ? state
          : { leftPanel: restored.leftPanel, rightPanel: restored.rightPanel };
      }

      queueStableSizeCacheWrite(path, size, status);

      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        status
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const cachedStale = state.sizeCacheStale[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        cachedStatus === status &&
        !cachedStale &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        ...(cachedStatus === status
          ? {}
          : {
              sizeStatusCache: {
                ...state.sizeStatusCache,
                [nextPanels.normalizedPath]: status,
              },
            }),
        ...(cachedStale
          ? {
              sizeCacheStale: {
                ...state.sizeCacheStale,
                [nextPanels.normalizedPath]: false,
              },
            }
          : {}),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    });
  },

  updateEntrySizeProgress: (_panel, path, size) =>
    set((state) => {
      const key = normalizePathKey(path);
      const previousSize = state.sizeCache[key];
      if (previousSize !== undefined) {
        rememberSizeBaseline(path, {
          size: previousSize,
          wasExact:
            state.sizeStatusCache[key] === "exact" ||
            Boolean(state.sizeCacheStale[key]),
        });

        // 재검증 중에는 이미 표시 중인 값보다 작은 진행값으로 되돌리지 않는다(0에서 다시 오르며 깜빡이고 정렬이 흔들림).
        if (size <= previousSize) {
          return state;
        }
      }

      const nextPanels = updateEntrySizeAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        size,
        "calculating"
      );
      const cachedSize = state.sizeCache[nextPanels.normalizedPath];

      if (
        cachedSize === size &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(cachedSize === size
          ? {}
          : {
              sizeCache: {
                ...state.sizeCache,
                [nextPanels.normalizedPath]: size,
              },
            }),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  setEntrySizeStatus: (_panel, path, status) =>
    set((state) => {
      const nextPanels = updateEntrySizeStatusAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        path,
        status
      );
      const cachedStatus = state.sizeStatusCache[nextPanels.normalizedPath];
      const nextSizeStatusCache = shouldCacheSizeStatus(status)
        ? {
            ...state.sizeStatusCache,
            [nextPanels.normalizedPath]: status,
          }
        : state.sizeStatusCache;
      const nextCachedStatus = shouldCacheSizeStatus(status)
        ? status
        : cachedStatus;

      if (
        nextCachedStatus === cachedStatus &&
        nextPanels.leftPanel === state.leftPanel &&
        nextPanels.rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(nextCachedStatus === cachedStatus
          ? {}
          : {
              sizeStatusCache: nextSizeStatusCache,
            }),
        leftPanel: nextPanels.leftPanel,
        rightPanel: nextPanels.rightPanel,
      };
    }),

  hydrateEntrySizesFromCache: (entries) =>
    set((state) => {
      if (entries.length === 0) {
        return state;
      }

      let leftPanel = state.leftPanel;
      let rightPanel = state.rightPanel;
      let changedSizeCache = false;
      let changedStatusCache = false;
      let changedStaleCache = false;
      const nextSizeCache = { ...state.sizeCache };
      const nextStatusCache = { ...state.sizeStatusCache };
      const nextStaleCache = { ...state.sizeCacheStale };

      for (const entry of entries) {
        const normalizedPath = normalizePathKey(entry.path);
        const existingStatus = state.sizeStatusCache[normalizedPath];
        // 복원한 신선한 정확한 값은 같은 세션에서 먼저 계산된 추정값보다 우선한다.
        const restoredExactBeatsEstimate =
          entry.status === "exact" && !entry.isStale && existingStatus === "estimated";
        const existingFreshStable =
          shouldCacheSizeStatus(existingStatus) &&
          !state.sizeCacheStale[normalizedPath];

        if (existingFreshStable && !restoredExactBeatsEstimate) {
          continue;
        }

        if (restoredExactBeatsEstimate) {
          dropPendingPersistentSizeCacheUpserts([normalizedPath]);
        }

        if (entry.scannedAt !== undefined) {
          recordSizeScannedAt(entry.path, entry.scannedAt);
        }

        const status = toHydratedStatus(entry.status, entry.isStale, entry.path);
        const nextPanels = updateEntrySizeAcrossPanels(
          leftPanel,
          rightPanel,
          normalizedPath,
          entry.size,
          status
        );
        leftPanel = nextPanels.leftPanel;
        rightPanel = nextPanels.rightPanel;

        if (nextSizeCache[normalizedPath] !== entry.size) {
          nextSizeCache[normalizedPath] = entry.size;
          changedSizeCache = true;
        }

        if (nextStatusCache[normalizedPath] !== status) {
          nextStatusCache[normalizedPath] = status;
          changedStatusCache = true;
        }

        if (nextStaleCache[normalizedPath] !== entry.isStale) {
          nextStaleCache[normalizedPath] = entry.isStale;
          changedStaleCache = true;
        }
      }

      if (
        !changedSizeCache &&
        !changedStatusCache &&
        !changedStaleCache &&
        leftPanel === state.leftPanel &&
        rightPanel === state.rightPanel
      ) {
        return state;
      }

      return {
        ...(changedSizeCache ? { sizeCache: nextSizeCache } : {}),
        ...(changedStatusCache ? { sizeStatusCache: nextStatusCache } : {}),
        ...(changedStaleCache ? { sizeCacheStale: nextStaleCache } : {}),
        leftPanel,
        rightPanel,
      };
    }),

  // 외부 파일 변경 감시용: 표시 중인 크기는 유지하고 stale로만 표시해 백그라운드에서 다시 계산한다.
  // 노이즈 디렉터리(node_modules, target 등) 안의 변경은 상위 폴더 크기에 반영하지 않는다.
  markEntrySizesStale: (paths) =>
    set((state) => {
      let nextStaleCache: Record<string, boolean> | null = null;

      for (const path of collectNoiseFilteredSizeStalePaths(paths)) {
        // 이미 stale이어도 변경 시각은 남겨 진행 중인 스캔 결과가 stale을 지우지 못하게 한다.
        recordSizeChange(path);
        if (state.sizeCache[path] === undefined || state.sizeCacheStale[path]) {
          continue;
        }

        nextStaleCache ??= { ...state.sizeCacheStale };
        nextStaleCache[path] = true;
      }

      return nextStaleCache ? { sizeCacheStale: nextStaleCache } : state;
    }),

  invalidateEntrySizes: (paths) =>
    set((state) => {
      const invalidatedPaths = collectEntrySizeInvalidationPaths(paths);
      queuePersistentSizeCacheDelete(invalidatedPaths);

      const nextState = invalidateEntrySizesAcrossPanels(
        state.leftPanel,
        state.rightPanel,
        state.sizeCache,
        state.sizeStatusCache,
        paths
      );

      const nextStaleCache = { ...state.sizeCacheStale };
      let changedStaleCache = false;
      for (const path of invalidatedPaths) {
        if (nextStaleCache[path] !== undefined) {
          delete nextStaleCache[path];
          changedStaleCache = true;
        }
      }

      if (!nextState) {
        return changedStaleCache ? { sizeCacheStale: nextStaleCache } : state;
      }

      return {
        ...nextState,
        ...(changedStaleCache ? { sizeCacheStale: nextStaleCache } : {}),
      };
    }),
});
