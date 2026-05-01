import { useEffect, useRef, useState } from "react";
import type { FileEntry, PanelId } from "../../types/file";

interface UseExpandedDirectoriesProps {
  currentPath: string;
  expandedChildrenVersion: number;
  files: FileEntry[];
  getDirSize: (path: string) => Promise<number>;
  listDirectory: (path: string, showHiddenFiles: boolean) => Promise<FileEntry[]>;
  panelId: PanelId;
  refreshKey: number;
  showHiddenFiles: boolean;
  setCursorIndex: (index: number) => void;
  updateEntrySize: (panel: PanelId, path: string, size: number) => void;
  focusContainer: () => void;
}

const filterParentEntry = (entries: FileEntry[]) =>
  entries.filter((entry) => entry.name !== "..");

export const useExpandedDirectories = ({
  currentPath,
  expandedChildrenVersion,
  files,
  getDirSize,
  listDirectory,
  panelId,
  refreshKey,
  showHiddenFiles,
  setCursorIndex,
  updateEntrySize,
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

  const calculateDirectorySize = (path: string, message: string) => {
    getDirSize(path)
      .then((size) => updateEntrySize(panelId, path, size))
      .catch((error) => console.error(message, error));
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
            calculateDirectorySize(
              child.path,
              "Failed to calculate child dir size:"
            );
          }
        });
      } catch (error) {
        console.error(`Failed to preview child entries for ${entry.path}:`, error);
        return;
      }
    }

    if (entry.size === undefined || entry.size === null) {
      calculateDirectorySize(entry.path, "Failed to calculate dir size:");
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
