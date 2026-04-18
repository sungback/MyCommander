import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { useUiStore } from "../../store/uiStore";
import { FileEntry } from "../../types/file";
import { useFileSystem } from "../../hooks/useFileSystem";
import { writeClipboardText } from "../../utils/clipboard";

let clearStatusMessageTimeoutId: number | undefined;

const getPanelAccessPath = (panel: { currentPath: string; resolvedPath?: string }) =>
  panel.resolvedPath ?? panel.currentPath;

const showTransientStatusMessage = (message: string, durationMs: number = 1400) => {
  const { setStatusMessage } = useUiStore.getState();
  if (clearStatusMessageTimeoutId !== undefined) {
    window.clearTimeout(clearStatusMessageTimeoutId);
  }

  setStatusMessage(message);
  clearStatusMessageTimeoutId = window.setTimeout(() => {
    useUiStore.getState().setStatusMessage(null);
    clearStatusMessageTimeoutId = undefined;
  }, durationMs);
};

const resolveContext = () => {
  const { panelId, targetPath } = useContextMenuStore.getState();
  const panelState = usePanelStore.getState();

  if (!panelId) {
    return null;
  }

  const panel = panelId === "left" ? panelState.leftPanel : panelState.rightPanel;
  const targetEntry: FileEntry | null =
    targetPath !== null
      ? panel.files.find((entry) => entry.path.normalize("NFC") === targetPath.normalize("NFC")) ??
        null
      : null;

  return {
    panelId,
    targetPath,
    panel,
    targetEntry,
  };
};

export const ContextMenu: React.FC = () => {
  const fs = useFileSystem();

  useEffect(() => {
    let isMounted = true;

    const attachListener = async () => {
      const unlisten = await listen<string>("context-menu-action", async (event) => {
        if (!isMounted) {
          return;
        }

        const context = resolveContext();
        if (!context) {
          return;
        }

        const { panelId, panel, targetPath, targetEntry } = context;
        const { setOpenDialog, openRenameDialog, openInfoDialog, closeDialog } =
          useDialogStore.getState();
        const { setActivePanel, refreshPanel } = usePanelStore.getState();
        const { closeContextMenu } = useContextMenuStore.getState();

        const openDialogForPanel = (
          dialog: "copy" | "move" | "delete" | "mkdir" | "newfile" | "search"
        ) => {
          setActivePanel(panelId);
          setOpenDialog(dialog);
          closeContextMenu();
        };

        try {
          switch (event.payload) {
            case "info":
              if (!targetPath) {
                return;
              }
              setActivePanel(panelId);
              openInfoDialog({ panelId, path: targetPath });
              closeContextMenu();
              return;
            case "reveal":
              await revealItemInDir(targetPath ?? panel.currentPath);
              closeContextMenu();
              return;
            case "terminal":
              await fs.openInTerminal(targetPath ?? panel.currentPath);
              closeContextMenu();
              return;
            case "create-zip": {
              if (!targetPath || !targetEntry || targetEntry.name === "..") {
                return;
              }
              setActivePanel(panelId);
              setOpenDialog("progress");
              const selectedPaths = [...panel.selectedItems];
              try {
                if (selectedPaths.length > 1) {
                  // 다중 선택: 선택된 항목 모두 압축
                  const archiveName =
                    panel.currentPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ??
                    "Archive";
                  await fs.createZipFromPaths(
                    selectedPaths,
                    getPanelAccessPath(panel),
                    archiveName
                  );
                } else {
                  if (targetEntry.kind !== "directory") {
                    closeDialog();
                    return;
                  }
                  await fs.createZip(targetPath);
                }
              } finally {
                closeDialog();
              }
              refreshPanel(panelId);
              closeContextMenu();
              return;
            }
            case "extract-zip":
              if (!targetPath || !targetEntry || targetEntry.kind !== "file") {
                return;
              }
              setActivePanel(panelId);
              await fs.extractZip(targetPath);
              refreshPanel(panelId);
              closeContextMenu();
              return;
            case "copy-path":
              await writeClipboardText(targetPath ?? panel.currentPath);
              showTransientStatusMessage("경로를 복사했습니다.");
              closeContextMenu();
              return;
            case "copy":
            case "move":
            case "delete":
            case "mkdir":
            case "newfile":
            case "search":
              openDialogForPanel(event.payload);
              return;
            case "rename":
              if (!targetPath || !targetEntry || targetEntry.name === "..") {
                return;
              }
              setActivePanel(panelId);
              openRenameDialog({ panelId, path: targetPath });
              closeContextMenu();
              return;
            case "refresh":
              refreshPanel(panelId);
              closeContextMenu();
              return;
            default:
              return;
          }
        } catch (error) {
          console.error("Failed to handle native context menu action:", error);
          const message =
            error instanceof Error
              ? error.message
              : typeof error === "string"
                ? error
                : "";

          switch (event.payload) {
            case "reveal":
              showTransientStatusMessage("항목 위치를 열 수 없습니다.");
              break;
            case "terminal":
              showTransientStatusMessage("터미널을 열 수 없습니다.");
              break;
            case "copy-path":
              showTransientStatusMessage("클립보드를 사용할 수 없습니다.");
              break;
            case "create-zip":
              if (message.toLowerCase().includes("canceled")) {
                showTransientStatusMessage("압축을 취소했습니다.");
                break;
              }
              showTransientStatusMessage("압축 작업을 완료하지 못했습니다.");
              break;
            case "extract-zip":
              showTransientStatusMessage("압축 작업을 완료하지 못했습니다.");
              break;
            default:
              showTransientStatusMessage("작업을 완료하지 못했습니다.");
              break;
          }
        }
      });

      if (!isMounted) {
        unlisten();
      }

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    void attachListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [fs]);

  return null;
};
