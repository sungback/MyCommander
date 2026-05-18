import { useEffect, useRef, useState } from "react";
import type { DirectorySizeStatus, FileEntry, PanelId } from "../../types/file";
import type { DirectorySizeEstimate } from "../../hooks/tauriCommands/fileCommands";
import { showTransientToast } from "../../store/toastStore";

interface UseExpandedDirectoriesProps {
  currentPath: string;
  expandedChildrenVersion: number;
  files: FileEntry[];
  estimateDirSize: (
    path: string,
    options?: { maxDepth?: number; maxEntries?: number }
  ) => Promise<DirectorySizeEstimate>;
  listDirectory: (path: string, showHiddenFiles: boolean) => Promise<FileEntry[]>;
  panelId: PanelId;
  refreshKey: number;
  showHiddenFiles: boolean;
  setCursorIndex: (index: number) => void;
  setEntrySizeStatus: (
    panel: PanelId,
    path: string,
    status: DirectorySizeStatus
  ) => void;
  updateEntrySizeEstimate: (
    panel: PanelId,
    path: string,
    size: number,
    status: Extract<DirectorySizeStatus, "estimated" | "partial">
  ) => void;
  focusContainer: () => void;
}

const filterParentEntry = (entries: FileEntry[]) =>
  entries.filter((entry) => entry.name !== "..");

export const useExpandedDirectories = ({
  currentPath,
  expandedChildrenVersion,
  files,
  estimateDirSize,
  listDirectory,
  panelId,
  refreshKey,
  showHiddenFiles,
  setCursorIndex,
  setEntrySizeStatus,
  updateEntrySizeEstimate,
  focusContainer,
}: UseExpandedDirectoriesProps) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childEntriesByPath, setChildEntriesByPath] = useState<
    Record<string, FileEntry[]>
  >({});
  const expandedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setExpandedPaths(new Set());
    expandedPathsRef.current = new Set();
    setChildEntriesByPath({});
  }, [currentPath, showHiddenFiles]);

  useEffect(() => {
    expandedPathsRef.current = expandedPaths;
  }, [expandedPaths]);

  useEffect(() => {
    const expandedPathsToRefresh = [...expandedPathsRef.current];

    if (expandedPathsToRefresh.length === 0) {
      return;
    }

    let cancelled = false;

    const refreshExpandedDirectories = async () => {
      const results = await Promise.all(
        expandedPathsToRefresh.map(async (path) => {
          try {
            const children = await listDirectory(path, showHiddenFiles);
            return {
              path,
              children: filterParentEntry(children),
            };
          } catch (error) {
            console.error(`Failed to refresh child entries for ${path}:`, error);
            return {
              path,
              children: null as FileEntry[] | null,
            };
          }
        })
      );

      if (cancelled) {
        return;
      }

      const nextExpandedPaths = new Set(expandedPathsRef.current);
      for (const result of results) {
        if (result.children === null) {
          nextExpandedPaths.delete(result.path);
        }
      }

      expandedPathsRef.current = nextExpandedPaths;
      setExpandedPaths(nextExpandedPaths);
      setChildEntriesByPath((current) => {
        const next = { ...current };

        for (const result of results) {
          if (result.children === null) {
            delete next[result.path];
            continue;
          }

          next[result.path] = result.children;
        }

        return next;
      });
    };

    void refreshExpandedDirectories();

    return () => {
      cancelled = true;
    };
  }, [currentPath, expandedChildrenVersion, files, listDirectory, refreshKey, showHiddenFiles]);

  const estimateDirectorySize = (path: string, message: string) => {
    setEntrySizeStatus(panelId, path, "estimating");
    estimateDirSize(path, { maxDepth: 1, maxEntries: 200 })
      .then((estimate) =>
        updateEntrySizeEstimate(
          panelId,
          path,
          estimate.size,
          estimate.isPartial ? "partial" : "estimated"
        )
      )
      .catch((error) => {
        setEntrySizeStatus(panelId, path, "error");
        console.error(message, error);
      });
  };

  const toggleExpanded = async (rowIndex: number, entry: FileEntry) => {
    if (entry.kind !== "directory" || entry.name === "..") return;

    setCursorIndex(rowIndex);
    focusContainer();

    if (expandedPaths.has(entry.path)) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.delete(entry.path);
        return next;
      });
      return;
    }

    if (!childEntriesByPath[entry.path]) {
      try {
        const children = await listDirectory(entry.path, showHiddenFiles);
        const validChildren = filterParentEntry(children);
        setChildEntriesByPath((current) => ({
          ...current,
          [entry.path]: validChildren,
        }));

        validChildren.forEach((child) => {
          if (
            child.kind === "directory" &&
            (child.size === undefined || child.size === null)
          ) {
            estimateDirectorySize(
              child.path,
              "Failed to estimate child dir size:"
            );
          }
        });
      } catch (error) {
        console.error(`Failed to preview child entries for ${entry.path}:`, error);
        showTransientToast(`폴더를 열 수 없습니다: ${entry.name}`, {
          tone: "error",
          durationMs: 2500,
        });
        return;
      }
    }

    if (entry.size === undefined || entry.size === null) {
      estimateDirectorySize(entry.path, "Failed to estimate dir size:");
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      next.add(entry.path);
      return next;
    });
  };

  return {
    childEntriesByPath,
    expandedPaths,
    toggleExpanded,
  };
};
