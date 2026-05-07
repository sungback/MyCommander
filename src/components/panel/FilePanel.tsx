import React, { useRef } from "react";
import { usePanelStore } from "../../store/panelStore";
import { AddressBar } from "./AddressBar";
import { ColumnHeader } from "./ColumnHeader";
import { FileList } from "./FileList";
import { clsx } from "clsx";
import { DriveList } from "./DriveList";
import { TabBar } from "./TabBar";
import { getErrorMessage, useFileSystem } from "../../hooks/useFileSystem";
import { coalescePanelPath, getParentPath } from "../../utils/path";
import { enterArchiveEntry, isArchiveEntry, isZipArchiveEntry } from "./archiveEnter";
import type { FileEntry } from "../../types/file";
import { useBackgroundDirSizes } from "./useBackgroundDirSizes";
import { useDirectoryLoader } from "./useDirectoryLoader";
import { usePanelContextMenu } from "./usePanelContextMenu";

interface FilePanelProps {
  id: "left" | "right";
}

export const FilePanel: React.FC<FilePanelProps> = ({ id }) => {
  const panelRef = useRef<HTMLDivElement>(null);
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
  const fs = useFileSystem();

  const isActive = activePanelId === id;

  useDirectoryLoader({
    activeTabId: panelState.activeTabId,
    currentPath: panelState.currentPath,
    lastUpdated: panelState.lastUpdated,
    panelId: id,
    setFiles,
    setPath,
    setResolvedPath,
    showHiddenFiles,
  });

  useBackgroundDirSizes({
    activeTabId: panelState.activeTabId,
    currentPath: panelState.currentPath,
    files: panelState.files,
    panelId: id,
    updateEntrySize,
  });

  usePanelContextMenu({
    files: panelState.files,
    panelId: id,
    panelRef,
    selectOnly,
    selectedItems: panelState.selectedItems,
    setActivePanel,
    setCursor,
  });

  const handleEnter = async (entry: FileEntry) => {
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
