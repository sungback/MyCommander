import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  submitZipDirectoryJob,
  submitZipSelectionJob,
} from "../../features/fileOperationJobs";
import {
  calculatePanelDirectorySizes,
  getPanelDirectorySizeCompletionMessage,
  getSingleDirectorySizeCompletionMessage,
  toggleDirectorySizeScan,
} from "../../hooks/directorySizeActions";
import type { useFileSystem } from "../../hooks/useFileSystem";
import { useContextMenuStore } from "../../store/contextMenuStore";
import { useDialogStore } from "../../store/dialogStore";
import { useJobStore } from "../../store/jobStore";
import { usePanelStore } from "../../store/panelStore";
import { showTransientToast } from "../../store/toastStore";
import type { FileEntry } from "../../types/file";
import { writeClipboardText } from "../../utils/clipboard";
import {
  buildNfcRenameTargetPath,
  hasDecomposedUnicodeFilename,
} from "../../utils/unicodeFilename";

type FileSystemFacade = ReturnType<typeof useFileSystem>;
type NativeContextMenuAction = string;

const resolveContext = () => {
  const { panelId, targetPath, targetEntry } = useContextMenuStore.getState();
  const panelState = usePanelStore.getState();

  if (!panelId) {
    return null;
  }

  const panel = panelId === "left" ? panelState.leftPanel : panelState.rightPanel;
  const resolvedTargetEntry: FileEntry | null =
    targetEntry ??
    (targetPath !== null
      ? panel.files.find(
          (entry) =>
            entry.path.normalize("NFC") === targetPath.normalize("NFC")
        ) ?? null
      : null);

  return {
    panelId,
    targetPath,
    panel,
    targetEntry: resolvedTargetEntry,
  };
};

const showContextMenuActionError = (
  action: NativeContextMenuAction,
  error: unknown
) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  switch (action) {
    case "reveal":
      showTransientToast("항목 위치를 열 수 없습니다.", { tone: "error" });
      break;
    case "terminal":
      showTransientToast("터미널을 열 수 없습니다.", { tone: "error" });
      break;
    case "calculate-size":
      showTransientToast("폴더 용량을 계산하지 못했습니다.", { tone: "error" });
      break;
    case "copy-path":
      showTransientToast("클립보드를 사용할 수 없습니다.", { tone: "error" });
      break;
    case "create-zip":
      if (message.toLowerCase().includes("canceled")) {
        showTransientToast("압축을 취소했습니다.", { tone: "warning" });
        break;
      }
      showTransientToast("압축 작업을 완료하지 못했습니다.", { tone: "error" });
      break;
    case "extract-zip":
      showTransientToast("압축 작업을 완료하지 못했습니다.", { tone: "error" });
      break;
    case "normalize-filename-nfc":
      showTransientToast("파일명을 NFC로 변환하지 못했습니다.", { tone: "error" });
      break;
    default:
      showTransientToast("작업을 완료하지 못했습니다.", { tone: "error" });
      break;
  }
};

export const handleNativeContextMenuAction = async (
  action: NativeContextMenuAction,
  fs: FileSystemFacade
) => {
  const context = resolveContext();
  if (!context) {
    return;
  }

  const { panelId, panel, targetPath, targetEntry } = context;
  const { setOpenDialog, openRenameDialog, openInfoDialog, closeDialog } =
    useDialogStore.getState();
  const {
    setActivePanel,
    refreshPanel,
    setEntrySizeStatus,
    updateEntrySize,
    updateEntrySizeEstimate,
    updateEntrySizeProgress,
  } = usePanelStore.getState();
  const { closeContextMenu } = useContextMenuStore.getState();

  const openDialogForPanel = (
    dialog: "copy" | "move" | "delete" | "mkdir" | "newfile" | "search"
  ) => {
    setActivePanel(panelId);
    setOpenDialog(dialog);
    closeContextMenu();
  };

  try {
    switch (action) {
      case "info":
        if (!targetPath) {
          return;
        }
        setActivePanel(panelId);
        openInfoDialog({ panelId, path: targetPath, entry: targetEntry || undefined });
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
      case "calculate-size":
        setActivePanel(panelId);
        closeContextMenu();
        if (targetPath && targetEntry?.kind === "directory" && targetEntry.name !== "..") {
          showTransientToast("폴더 용량 계산을 시작했습니다.");
          const result = await toggleDirectorySizeScan({
            cancelDirSizeScan: fs.cancelDirSizeScan,
            panelId,
            path: targetPath,
            scanDirSize: fs.scanDirSize,
            setEntrySizeStatus,
            updateEntrySize,
            updateEntrySizeEstimate,
            updateEntrySizeProgress,
          });

          if (result.status === "cancelled") {
            showTransientToast("폴더 용량 계산을 취소했습니다.", {
              tone: "warning",
            });
            return;
          }

          const message = getSingleDirectorySizeCompletionMessage(
            targetEntry.name,
            result
          );
          if (message) {
            showTransientToast(message);
          }
          return;
        }

        showTransientToast("폴더 용량 계산을 시작했습니다.");
        {
          const result = await calculatePanelDirectorySizes({
            cancelDirSizeScan: fs.cancelDirSizeScan,
            panelId,
            panel,
            scanDirSize: fs.scanDirSize,
            setEntrySizeStatus,
            updateEntrySize,
            updateEntrySizeEstimate,
            updateEntrySizeProgress,
          });
          showTransientToast(getPanelDirectorySizeCompletionMessage(result));
        }
        return;
      case "create-zip": {
        if (!targetPath || !targetEntry || targetEntry.name === "..") {
          return;
        }
        setActivePanel(panelId);
        const selectedPaths = [...panel.selectedItems];
        const submittedJob =
          selectedPaths.length > 1
            ? await submitZipSelectionJob(fs, selectedPaths, panel)
            : await (async () => {
                if (targetEntry.kind !== "directory") {
                  closeDialog();
                  return null;
                }

                return submitZipDirectoryJob(fs, targetPath);
              })();

        if (!submittedJob) {
          return;
        }

        useJobStore.getState().upsertJob(submittedJob);
        setOpenDialog("progress");
        showTransientToast("압축 작업이 대기열에 추가되었습니다.");
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
        showTransientToast("경로를 복사했습니다.");
        closeContextMenu();
        return;
      case "copy":
      case "move":
      case "delete":
      case "mkdir":
      case "newfile":
      case "search":
        openDialogForPanel(action);
        return;
      case "rename":
        if (!targetPath || !targetEntry || targetEntry.name === "..") {
          return;
        }
        setActivePanel(panelId);
        openRenameDialog({ panelId, path: targetPath, entry: targetEntry });
        closeContextMenu();
        return;
      case "normalize-filename-nfc":
        if (
          !targetPath ||
          !targetEntry ||
          targetEntry.name === ".." ||
          !hasDecomposedUnicodeFilename(targetEntry.name)
        ) {
          return;
        }

        setActivePanel(panelId);
        await fs.renameFile(
          targetPath,
          buildNfcRenameTargetPath(targetPath, targetEntry.name)
        );
        refreshPanel(panelId);
        showTransientToast("파일명을 NFC로 변환했습니다.");
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
    showContextMenuActionError(action, error);
  }
};
