import React, { useRef } from "react";
import { useDragStore } from "../../store/dragStore";
import type { PanelId } from "../../types/file";
import { getExternalDropPaths } from "./fileListExternalDrop";

interface UseExternalFileDropOptions {
  accessPath: string;
  panelId: PanelId;
  handleDraggedCopy: (
    paths: string[],
    targetPath: string,
    targetPanelId: PanelId
  ) => Promise<boolean>;
}

export const useExternalFileDrop = ({
  accessPath,
  panelId,
  handleDraggedCopy,
}: UseExternalFileDropOptions) => {
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;

    const activeDragInfo = useDragStore.getState().dragInfo;

    if (activeDragInfo) {
      return;
    }

    if (e.dataTransfer.files.length > 0) {
      const paths = getExternalDropPaths(e.dataTransfer.files);
      if (paths.length > 0) {
        try {
          await handleDraggedCopy(paths, accessPath, panelId);
        } catch (error) {
          console.error("Failed to copy external files:", error);
        }
      }
    }
  };

  return {
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
