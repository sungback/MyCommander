import { showTransientToast } from "../../store/toastStore";
import type { PanelId } from "../../types/file";
import type {
  CrossPanelDropIntent,
  SamePanelDropIntent,
} from "./fileListDragRules";

type DragCopyHandler = (
  paths: string[],
  targetPath: string,
  targetPanel: PanelId
) => Promise<unknown>;

type DragMoveHandler = (
  paths: string[],
  targetPath: string
) => Promise<unknown>;

interface RunSamePanelDropActionArgs {
  paths: string[];
  panelId: PanelId;
  intent: SamePanelDropIntent;
  handleDraggedCopy: DragCopyHandler;
  handleDraggedMove: DragMoveHandler;
}

export const runSamePanelDropAction = ({
  paths,
  panelId,
  intent,
  handleDraggedCopy,
  handleDraggedMove,
}: RunSamePanelDropActionArgs) => {
  if (!intent.isDropAllowed) {
    showTransientToast(intent.blockedReason ?? "여기로는 복사할 수 없습니다.", {
      durationMs: 1800,
      tone: "warning",
    });
    return;
  }

  const dragAction = intent.isFolderOnlyMove
    ? handleDraggedMove(paths, intent.targetPath)
    : handleDraggedCopy(paths, intent.targetPath, panelId);

  void dragAction.catch((error) => {
    console.error("Failed to process dragged files:", error);
    showTransientToast(
      intent.isFolderOnlyMove
        ? "폴더를 이동하지 못했습니다."
        : "파일을 복사하지 못했습니다.",
      { durationMs: 1800, tone: "error" }
    );
  });
};

interface RunCrossPanelDropActionArgs {
  paths: string[];
  intent: CrossPanelDropIntent;
  handleDraggedCopy: DragCopyHandler;
}

export const runCrossPanelDropAction = ({
  paths,
  intent,
  handleDraggedCopy,
}: RunCrossPanelDropActionArgs): "blocked" | "submitted" => {
  if (intent.blockedReason) {
    showTransientToast(intent.blockedReason, {
      durationMs: 1800,
      tone: "warning",
    });
    return "blocked";
  }

  void handleDraggedCopy(paths, intent.targetPath, intent.targetPanel).catch(
    (error) => {
      console.error("Failed to copy dragged files:", error);
      showTransientToast("파일을 복사하지 못했습니다.", {
        durationMs: 1800,
        tone: "error",
      });
    }
  );

  return "submitted";
};
