import { useEffect, useRef } from "react";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import type { FileEntry, PanelId } from "../../types/file";

interface UseDirectoryLoaderProps {
  activeTabId: string;
  currentPath: string;
  lastUpdated: number;
  panelId: PanelId;
  setFiles: (panel: PanelId, files: FileEntry[]) => void;
  setPath: (panel: PanelId, path: string, pendingCursorName?: string) => void;
  setResolvedPath: (panel: PanelId, path: string) => void;
  showHiddenFiles: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
}

const getLeafName = (path: string) =>
  path.replace(/[\\/]+$/, "").replace(/\\/g, "/").split("/").pop() || null;

export const useDirectoryLoader = ({
  activeTabId,
  currentPath,
  lastUpdated,
  panelId,
  setFiles,
  setPath,
  setResolvedPath,
  showHiddenFiles,
  onLoadStart,
  onLoadEnd,
}: UseDirectoryLoaderProps) => {
  const fs = useFileSystem();
  const lastLoadedPathRef = useRef<string | null>(null);
  const lastResolvedPathRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activePath = currentPath;

    onLoadStart?.();

    const commitLoadedEntries = (
      path: string,
      resolvedPath: string,
      entries: FileEntry[]
    ) => {
      if (cancelled) {
        return;
      }

      if (path !== currentPath) {
        setPath(panelId, path);
      }
      setResolvedPath(panelId, resolvedPath);
      setFiles(panelId, entries);
      lastLoadedPathRef.current = path;
      lastResolvedPathRef.current = resolvedPath;
      onLoadEnd?.();
    };

    const loadDir = async () => {
      try {
        let accessPath = activePath;
        try {
          accessPath = await fs.resolvePath(activePath);
        } catch (resolveError) {
          console.warn(`Failed to resolve path for ${activePath}:`, resolveError);
        }

        const entries = await fs.listDirectory(accessPath, showHiddenFiles);
        commitLoadedEntries(activePath, accessPath, entries);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed loading dir: ", error);
        onLoadEnd?.();

        const previousPath = lastLoadedPathRef.current;
        const previousResolvedPath = lastResolvedPathRef.current;
        if (previousPath && previousPath !== currentPath) {
          setPath(panelId, previousPath, getLeafName(currentPath) ?? undefined);
          if (previousResolvedPath) {
            setResolvedPath(panelId, previousResolvedPath);
          }
        }

        window.alert(getErrorMessage(error, `${currentPath} 폴더를 열지 못했습니다.`));
      }
    };

    void loadDir();

    return () => {
      cancelled = true;
    };
  }, [
    activeTabId,
    currentPath,
    fs,
    lastUpdated,
    onLoadEnd,
    onLoadStart,
    panelId,
    setFiles,
    setPath,
    setResolvedPath,
    showHiddenFiles,
  ]);
};
