import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  FileText,
  ImageIcon,
  VideoIcon,
  AlertCircle,
  Loader2,
  Code2,
  Eye,
} from "lucide-react";
import { useDialogStore } from "../../store/dialogStore";
import {
  type PreviewState,
  getFileName,
  loadPreviewForPath,
  loadSourceHighlightHtml,
} from "./quickPreviewLoader";
import {
  type PreviewStatusContent,
  getPreviewStatusContent,
} from "./quickPreviewStatus";

const getStatusIcon = (status: PreviewStatusContent) => {
  if (status.kind === "loading") {
    return <Loader2 size={24} className="animate-spin" />;
  }

  if (status.kind === "unsupported") {
    return <FileText size={24} />;
  }

  return <AlertCircle size={24} className="text-red-500" />;
};

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
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {preview.type === "image" ? (
                <ImageIcon size={14} className="text-text-secondary shrink-0" />
              ) : preview.type === "video" ? (
                <VideoIcon size={14} className="text-text-secondary shrink-0" />
              ) : isRendered ? (
                <Eye size={14} className="text-text-secondary shrink-0" />
              ) : (
                <FileText size={14} className="text-text-secondary shrink-0" />
              )}
              {preview.type === "pdf" && (
                <span className="shrink-0 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono">
                  PDF
                </span>
              )}
              <Dialog.Title className="text-sm font-medium text-text-primary truncate">
                {fileName}
              </Dialog.Title>
              {preview.language && (
                <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
                  {preview.language}
                </span>
              )}
              {preview.renderExt && (
                <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
                  {preview.renderExt}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-4 shrink-0">
              {canToggleSource && (
                <button
                  onClick={() => setShowSource((value) => !value)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title={showSource ? "렌더링 보기" : "소스 보기"}
                >
                  {showSource ? <Eye size={12} /> : <Code2 size={12} />}
                  <span>{showSource ? "렌더링" : "소스"}</span>
                </button>
              )}
              <button
                onClick={closeDialog}
                className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {previewStatus && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center text-text-secondary">
                {getStatusIcon(previewStatus)}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">
                    {previewStatus.title}
                  </p>
                  <p className="text-xs">{previewStatus.description}</p>
                </div>
                {previewStatus.detail && (
                  <p className="max-w-xs break-all font-mono text-xs text-red-400">
                    {previewStatus.detail}
                  </p>
                )}
              </div>
            )}

            {preview.type === "image" && preview.src && (
              <div className="flex items-center justify-center p-4 overflow-auto flex-1">
                <img
                  src={preview.src}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded select-none"
                  draggable={false}
                />
              </div>
            )}

            {preview.type === "video" && preview.src && (
              <div className="flex items-center justify-center flex-1 bg-black">
                <video
                  src={preview.src}
                  controls
                  className="max-w-full max-h-full"
                  style={{ maxHeight: "calc(100% - 0px)" }}
                >
                  지원하지 않는 형식입니다.
                </video>
              </div>
            )}

            {preview.type === "pdf" && preview.src && (
              <iframe
                src={preview.src}
                className="w-full flex-1 border-none"
                title="PDF preview"
              />
            )}

            {preview.type === "rendered" && !showSource && preview.renderedHtml && (
              <iframe
                srcDoc={preview.renderedHtml}
                className="w-full flex-1 border-none"
                sandbox="allow-same-origin"
                title="rendered preview"
              />
            )}

            {preview.type === "rendered" && showSource && (
              sourceHighlightHtml ? (
                <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
                  <code
                    className="hljs block p-4 min-h-full"
                    dangerouslySetInnerHTML={{ __html: sourceHighlightHtml }}
                  />
                </pre>
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                  {preview.content}
                </pre>
              )
            )}

            {preview.type === "text" && (
              preview.highlightedHtml ? (
                <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
                  <code
                    className="hljs block p-4 min-h-full"
                    dangerouslySetInnerHTML={{ __html: preview.highlightedHtml }}
                  />
                </pre>
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                  {preview.content}
                </pre>
              )
            )}

          </div>

          <div className="px-4 py-2 border-t border-border-color shrink-0 flex justify-between items-center">
            <span className="text-xs text-text-secondary font-mono truncate">{filePath}</span>
            <span className="text-xs text-text-secondary shrink-0 ml-4">
              Press{" "}
              <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">
                Space
              </kbd>
              {" "}or{" "}
              <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">
                Esc
              </kbd>
              {" "}to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
