import { useCallback, useEffect, useState } from "react";
import {
  type PreviewState,
  loadPreviewForPath,
  loadSourceHighlightHtml,
} from "./quickPreviewLoader";

interface UseQuickPreviewStateArgs {
  isOpen: boolean;
  filePath: string;
}

export const useQuickPreviewState = ({
  isOpen,
  filePath,
}: UseQuickPreviewStateArgs) => {
  const [preview, setPreview] = useState<PreviewState>({ type: "loading" });
  const [showSource, setShowSource] = useState(false);
  const [sourceHighlightHtml, setSourceHighlightHtml] = useState<string | null>(null);

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

  const isRendered = preview.type === "rendered";
  const canToggleSource = isRendered && Boolean(preview.content);

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

  const toggleSource = useCallback(() => {
    setShowSource((value) => !value);
  }, []);

  return {
    preview,
    showSource,
    sourceHighlightHtml,
    isRendered,
    canToggleSource,
    toggleSource,
  };
};
