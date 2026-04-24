import React, { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePanelStore } from "../../store/panelStore";
import { AddressBar } from "./AddressBar";
import { ColumnHeader } from "./ColumnHeader";
import { FileList } from "./FileList";
import { clsx } from "clsx";
import { DriveList } from "./DriveList";
import { TabBar } from "./TabBar";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { coalescePanelPath, getParentPath } from "../../utils/path";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { enterArchiveEntry, isArchiveEntry, isZipArchiveEntry } from "./archiveEnter";
import { FileEntry, FileType } from "../../types/file";

interface FilePanelProps {
  id: "left" | "right";
}

const MAX_BACKGROUND_DIR_SIZE_WORKERS = 2;

interface BackgroundSizeScheduler {
  activeCount: number;
  queue: Array<{ path: string }>;
  queuedPaths: Set<string>;
}

export const FilePanel: React.FC<FilePanelProps> = ({ id }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastLoadedPathRef = useRef<string | null>(null);
  const lastResolvedPathRef = useRef<string | null>(null);
  const panelState = usePanelStore((s) => id === "left" ? s.leftPanel : s.rightPanel);
  const activePanelId = usePanelStore((s) => s.activePanel);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const viewMode = usePanelStore((s) => s.panelViewModes[id]);
  const setActivePanel = usePanelStore((s) => s.setActivePanel);
  const toggleSelection = usePanelStore((s) => s.toggleSelection);
  const setCursor = usePanelStore((s) => s.setCursor);
  const setPath = usePanelStore((s) => s.setPath);
  const setFiles = usePanelStore((s) => s.setFiles);
  const setResolvedPath = usePanelStore((s) => s.setResolvedPath);
  const setPendingCursorName = usePanelStore((s) => s.setPendingCursorName);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const updateEntrySize = usePanelStore((s) => s.updateEntrySize);
  const selectOnly = usePanelStore((s) => s.selectOnly);
  const openContextMenu = useContextMenuStore((s) => s.openContextMenu);
  const fs = useFileSystem();
  const backgroundSchedulerRef = useRef<BackgroundSizeScheduler>({
    activeCount: 0,
    queue: [],
    queuedPaths: new Set(),
  });

  const isActive = activePanelId === id;

  useEffect(() => {
    let cancelled = false;
    let activePath = panelState.currentPath;
    const startedFromRootPlaceholder = activePath === "/";

    const getLeafName = (path: string) =>
      path.replace(/[\\/]+$/, "").replace(/\\/g, "/").split("/").pop() || null;

    const loadDir = async () => {
      const resolveHomeDirectory = async () => {
        const home = await fs.getHomeDir();
        if (cancelled) {
          return home;
        }
        activePath = home;
        setPath(id, home);
        return home;
      };

      const commitLoadedEntries = (
        path: string,
        resolvedPath: string,
        entries: Parameters<typeof setFiles>[1]
      ) => {
        if (cancelled) {
          return;
        }

        if (path !== panelState.currentPath) {
          setPath(id, path);
        }
        setResolvedPath(id, resolvedPath);
        setFiles(id, entries);
        lastLoadedPathRef.current = path;
        lastResolvedPathRef.current = resolvedPath;
      };

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
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error("Failed loading dir: ", err);

        const previousPath = lastLoadedPathRef.current;
        const previousResolvedPath = lastResolvedPathRef.current;
        if (previousPath && previousPath !== panelState.currentPath) {
          setPath(id, previousPath, getLeafName(panelState.currentPath) ?? undefined);
          if (previousResolvedPath) {
            setResolvedPath(id, previousResolvedPath);
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

        window.alert(
          getErrorMessage(err, `${panelState.currentPath} 폴더를 열지 못했습니다.`)
        );
      }
    };

    void loadDir();

    return () => {
      cancelled = true;
    };
  }, [
    fs,
    id,
    panelState.activeTabId,
    panelState.currentPath,
    panelState.lastUpdated,
    setFiles,
    setPath,
    showHiddenFiles,
  ]);

  useEffect(() => {
    backgroundSchedulerRef.current = {
      activeCount: 0,
      queue: [],
      queuedPaths: new Set(),
    };
  }, [id, panelState.activeTabId, panelState.currentPath]);

  useEffect(() => {
    const scheduler = backgroundSchedulerRef.current;
    const pendingDirectories = panelState.files.filter(
      (entry) =>
        entry.kind === "directory" &&
        entry.name !== ".." &&
        (entry.size === undefined || entry.size === null) &&
        !scheduler.queuedPaths.has(entry.path)
    );

    if (pendingDirectories.length === 0) {
      return;
    }

    const drainQueue = () => {
      while (
        scheduler.activeCount < MAX_BACKGROUND_DIR_SIZE_WORKERS &&
        scheduler.queue.length > 0
      ) {
        const entry = scheduler.queue.shift();
        if (!entry) {
          return;
        }

        scheduler.activeCount += 1;

        void fs
          .getDirSize(entry.path)
          .then((size) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            updateEntrySize(id, entry.path, size);
          })
          .catch((error) => {
            if (backgroundSchedulerRef.current !== scheduler) {
              return;
            }

            console.error(`Failed to calculate background dir size for ${entry.path}:`, error);
          })
          .finally(() => {
            scheduler.queuedPaths.delete(entry.path);
            scheduler.activeCount -= 1;

            if (backgroundSchedulerRef.current === scheduler) {
              drainQueue();
            }
          });
      }
    };

    for (const entry of pendingDirectories) {
      scheduler.queue.push({ path: entry.path });
      scheduler.queuedPaths.add(entry.path);
    }

    drainQueue();
  }, [fs, id, panelState.files, panelState.currentPath, updateEntrySize]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      setActivePanel(id);

      const entryElement = target.closest<HTMLElement>("[data-entry-path]");
      const entryPath = entryElement?.dataset.entryPath ?? null;
      const entryIndex = entryElement?.dataset.entryIndex
        ? Number(entryElement.dataset.entryIndex)
        : null;

      if (entryPath) {
        if (entryIndex !== null && Number.isFinite(entryIndex)) {
          setCursor(id, entryIndex);
        }

        if (!panelState.selectedItems.has(entryPath)) {
          selectOnly(id, entryPath);
        }
      }

      let targetEntry: FileEntry | null = null;
      if (entryPath) {
        targetEntry = panelState.files.find(
          (entry) => entry.path.normalize("NFC") === entryPath.normalize("NFC")
        ) ?? null;

        if (!targetEntry && entryElement) {
          const kind = entryElement.dataset.entryKind as FileType;
          if (kind) {
            targetEntry = {
              name: entryElement.dataset.entryName || "",
              path: entryPath,
              kind,
              isHidden: entryElement.dataset.entryIsHidden === "true"
            };
          }
        }
      }

      openContextMenu({
        panelId: id,
        targetPath: entryPath,
        targetEntry,
        x: event.clientX,
        y: event.clientY,
      });

      const selectedCount = panelState.selectedItems.size;
      const canCreateZip = Boolean(
        targetEntry && targetEntry.name !== ".." &&
        (targetEntry.kind === "directory" || selectedCount > 1)
      );
      const canExtractZip = Boolean(
        targetEntry &&
        targetEntry.kind === "file" &&
        targetEntry.name.toLowerCase().endsWith(".zip")
      );

      void invoke("show_context_menu", {
        request: {
          x: event.clientX,
          y: event.clientY,
          has_target_item: entryPath !== null,
          can_rename: Boolean(targetEntry && targetEntry.name !== ".."),
          can_create_zip: canCreateZip,
          can_extract_zip: canExtractZip,
        },
      }).catch((error) => {
        console.error("Failed to show context menu:", error);
        window.alert(getErrorMessage(error, "컨텍스트 메뉴를 열지 못했습니다."));
      });
    };

    panelElement.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      panelElement.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [id, openContextMenu, panelState.selectedItems, selectOnly, setActivePanel, setCursor]);

  const handleEnter = async (entry: any) => {
    const openDirectoryEntry = async (targetPath: string) => {
      let resolvedPath = targetPath;

      try {
        resolvedPath = await fs.resolvePath(targetPath);
      } catch (error) {
        console.warn(`Failed to resolve path for ${targetPath}:`, error);
      }

      const candidatePaths = Array.from(
        new Set([resolvedPath, targetPath].filter((path) => path.length > 0))
      );

      let lastError: unknown = null;
      for (const candidatePath of candidatePaths) {
        try {
          await fs.listDirectory(candidatePath, showHiddenFiles);
          setPath(id, targetPath);
          return true;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error(`${targetPath} 폴더를 열지 못했습니다.`);
    };

    if (entry.kind === "directory" || entry.kind === "symlink") {
      if (entry.name === "..") {
        const currentName = panelState.currentPath
          .replace(/[\\/]+$/, "")
          .replace(/\\/g, "/")
          .split("/")
          .pop();
        setPath(id, getParentPath(panelState.currentPath), currentName);
        return;
      }

      try {
        await openDirectoryEntry(entry.path);
        return;
      } catch (error) {
        console.error(`Failed to enter directory ${entry.path}:`, error);
        window.alert(getErrorMessage(error, `${entry.path} 폴더를 열지 못했습니다.`));
        return;
      }
    } else {
      const isZipArchive = isZipArchiveEntry(entry);

      if (!isArchiveEntry(entry)) {
        try {
          await fs.openFile(entry.path);
        } catch (error) {
          console.error("Failed to open file:", error);
          window.alert(getErrorMessage(error, `${entry.path} 파일을 열지 못했습니다.`));
        }
        return;
      }

      try {
        const handled = await enterArchiveEntry({
          entry,
          fs,
          onZipExtracted: isZipArchive
            ? () => {
                setPendingCursorName(id, entry.name);
                refreshPanel(id);
              }
            : undefined,
        });

        if (!handled) {
          console.log("Cannot enter file, need to open:", entry.path);
          return;
        }
      } catch (error) {
        console.error("Failed to open archive file:", error);
        window.alert(
          getErrorMessage(
            error,
            isZipArchive
              ? "Failed to extract zip archive."
              : "Failed to open disk image."
          )
        );
      }
    }
  };

  return (
    <div
      ref={panelRef}
      className={clsx(
        "flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-opacity bg-bg-panel"
      )}
      onClickCapture={() => {
        if (!isActive) {
          setActivePanel(id);
        }
      }}
    >
      <DriveList panelId={id} />
      <TabBar panelId={id} />
      <AddressBar panelId={id} />
      {viewMode === "detailed" ? (
        <ColumnHeader
          sortField={panelState.sortField}
          sortDirection={panelState.sortDirection}
          onSort={(field) => usePanelStore.getState().setSort(id, field)}
        />
      ) : null}
      <FileList
        currentPath={panelState.currentPath}
        accessPath={coalescePanelPath(panelState.resolvedPath, panelState.currentPath)}
        files={panelState.files}
        selectedItems={panelState.selectedItems}
        cursorIndex={panelState.cursorIndex}
        isActivePanel={isActive}
        panelId={id}
        viewMode={viewMode}
        onSelect={(path, _toggle) => toggleSelection(id, path)}
        onEnter={handleEnter}
        setCursorIndex={(idx) => setCursor(id, idx)}
      />
    </div>
  );
};
