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
}: UseDirectoryLoaderProps) => {
  const fs = useFileSystem();
  const lastLoadedPathRef = useRef<string | null>(null);
  const lastResolvedPathRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activePath = currentPath;
    const startedFromRootPlaceholder = activePath === "/";

    const resolveHomeDirectory = async () => {
      const home = await fs.getHomeDir();
      if (cancelled) {
        return home;
      }

      activePath = home;
      setPath(panelId, home);
      return home;
    };

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
    };

    const loadDir = async () => {
      try {
        // Only replace the generic root placeholder. Windows drive roots are real targets.
        if (activePath === "/") {
          activePath = await resolveHomeDirectory();
        }

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

        const previousPath = lastLoadedPathRef.current;
        const previousResolvedPath = lastResolvedPathRef.current;
        if (previousPath && previousPath !== currentPath) {
          setPath(panelId, previousPath, getLeafName(currentPath) ?? undefined);
          if (previousResolvedPath) {
            setResolvedPath(panelId, previousResolvedPath);
          }
        } else if (startedFromRootPlaceholder) {
          try {
            const home = await resolveHomeDirectory();
            if (cancelled) {
              return;
            }

            let resolvedHome = home;
            try {
              resolvedHome = await fs.resolvePath(home);
            } catch (resolveHomeError) {
              console.warn(`Failed to resolve home path for ${home}:`, resolveHomeError);
            }

            const entries = await fs.listDirectory(resolvedHome, showHiddenFiles);
            commitLoadedEntries(home, resolvedHome, entries);
          } catch (fallbackError) {
            console.error("Failed loading fallback home dir: ", fallbackError);
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
    panelId,
    setFiles,
    setPath,
    setResolvedPath,
    showHiddenFiles,
  ]);
};
