import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import {
  type PreviewState,
  getFileName,
  loadPreviewForPath,
  loadSourceHighlightHtml,
} from "./quickPreviewLoader";
import { getPreviewStatusContent } from "./quickPreviewStatus";
import {
  QuickPreviewBody,
  QuickPreviewFooter,
  QuickPreviewHeader,
} from "./QuickPreviewDialogViews";

export const QuickPreviewDialog: React.FC = () => {
  const { openDialog, dialogTarget, closeDialog } = useDialogStore();
  const isOpen = openDialog === "preview" && dialogTarget != null;
  const filePath = dialogTarget?.path ?? "";
  const fileName = getFileName(filePath);

  const [preview, setPreview] = useState<PreviewState>({ type: "loading" });
  const [showSource, setShowSource] = useState(false);
  const [sourceHighlightHtml, setSourceHighlightHtml] = useState<string | null>(null);
  const lastTargetPanelRef = useRef<string | null>(null);

  useEffect(() => {
    if (dialogTarget?.panelId) {
      lastTargetPanelRef.current = dialogTarget.panelId;
    }
  }, [dialogTarget]);

  useEffect(() => {
    setShowSource(false);
    setSourceHighlightHtml(null);
  }, [filePath]);

  const loadPreview = useCallback(async (path: string) => {
    setPreview({ type: "loading" });

    try {
      const nextPreview = await loadPreviewForPath(path);
      setPreview(nextPreview);
    } catch (error) {
      console.error("QuickPreview: failed to load file", error);
      setPreview({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen && filePath) {
      void loadPreview(filePath);
    }
  }, [isOpen, filePath, loadPreview]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        event.stopPropagation();
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isOpen, closeDialog]);

  const isRendered = preview.type === "rendered";
  const canToggleSource = isRendered && Boolean(preview.content);
  const previewStatus = getPreviewStatusContent(preview);

  useEffect(() => {
    let cancelled = false;

    if (!canToggleSource || !showSource || !preview.content) {
      setSourceHighlightHtml(null);
      return () => {
        cancelled = true;
      };
    }

    void loadSourceHighlightHtml(preview.content, preview.renderExt ?? "")
      .then((html) => {
        if (!cancelled) {
          setSourceHighlightHtml(html);
        }
      })
      .catch((error) => {
        console.error("QuickPreview: failed to highlight preview source", error);
        if (!cancelled) {
          setSourceHighlightHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canToggleSource, showSource, preview.content, preview.renderExt]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const targetPanelId = dialogTarget?.panelId || lastTargetPanelRef.current;
            if (targetPanelId) {
              const panelElement = document.querySelector(
                `[data-panel-id="${targetPanelId}"]`
              ) as HTMLElement | null;

              if (panelElement) {
                setTimeout(() => {
                  panelElement.focus({ preventScroll: true });
                }, 10);
              }
            }
          }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col bg-bg-panel border border-border-color rounded-lg shadow-2xl focus:outline-none"
          style={{ width: "min(95vw, 1280px)", height: "min(95vh, 900px)" }}
        >
          <QuickPreviewHeader
            preview={preview}
            fileName={fileName}
            isRendered={isRendered}
            canToggleSource={canToggleSource}
            showSource={showSource}
            onToggleSource={() => setShowSource((value) => !value)}
            onClose={closeDialog}
          />
          <QuickPreviewBody
            preview={preview}
            previewStatus={previewStatus}
            fileName={fileName}
            showSource={showSource}
            sourceHighlightHtml={sourceHighlightHtml}
          />
          <QuickPreviewFooter filePath={filePath} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
