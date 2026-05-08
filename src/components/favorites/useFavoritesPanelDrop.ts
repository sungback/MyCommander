import { useEffect, useRef, useState } from "react";
import { useDragStore } from "../../store/dragStore";
import { useFavoriteStore } from "../../store/favoriteStore";
import { showTransientToast } from "../../store/toastStore";

export const useFavoritesPanelDrop = () => {
  const addFavorite = useFavoriteStore((s) => s.addFavorite);
  const dragInfo = useDragStore((s) => s.dragInfo);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const isDraggedFolderOverPanelRef = useRef(false);
  const [isDraggedFolderOverPanel, setIsDraggedFolderOverPanel] = useState(false);

  const draggedDirectoryPaths = dragInfo?.directoryPaths ?? [];
  const canDropDraggedFolders = dragInfo !== null && draggedDirectoryPaths.length > 0;
  const isInvalidExternalDrop = dragInfo !== null && draggedDirectoryPaths.length === 0;

  useEffect(() => {
    if (!dragInfo) {
      isDraggedFolderOverPanelRef.current = false;
      setIsDraggedFolderOverPanel(false);
      return;
    }

    const updateHoverState = (isOver: boolean) => {
      isDraggedFolderOverPanelRef.current = isOver;
      setIsDraggedFolderOverPanel((current) => (current === isOver ? current : isOver));
    };

    const isPointerInsidePanel = (clientX: number, clientY: number) => {
      const panelElement = panelRef.current;
      if (!panelElement) {
        return false;
      }

      const rect = panelElement.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (dragIdRef.current) {
        return;
      }

      updateHoverState(isPointerInsidePanel(event.clientX, event.clientY));
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (dragIdRef.current) {
        return;
      }

      const isPointerInside = isPointerInsidePanel(event.clientX, event.clientY);
      updateHoverState(false);

      if (!isPointerInside) {
        return;
      }

      if (!canDropDraggedFolders) {
        showTransientToast("폴더만 즐겨찾기에 추가할 수 있습니다.", {
          durationMs: 1800,
          tone: "warning",
        });
        return;
      }

      const existingPaths = new Set(
        useFavoriteStore.getState().favorites.map((favorite) => favorite.path)
      );
      const uniquePaths = Array.from(new Set(draggedDirectoryPaths)).filter(
        (path) => !existingPaths.has(path)
      );

      if (uniquePaths.length === 0) {
        showTransientToast("이미 즐겨찾기에 등록된 폴더입니다.", {
          durationMs: 1800,
          tone: "warning",
        });
        return;
      }

      uniquePaths.forEach((path) => addFavorite(path));
      showTransientToast(
        uniquePaths.length === 1
          ? "즐겨찾기에 폴더를 추가했습니다."
          : `즐겨찾기에 폴더 ${uniquePaths.length}개를 추가했습니다.`,
        { durationMs: 1800, tone: "success" }
      );
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [addFavorite, canDropDraggedFolders, dragInfo, draggedDirectoryPaths]);

  return {
    panelRef,
    dragIdRef,
    isDraggedFolderOverPanel,
    canDropDraggedFolders,
    isInvalidExternalDrop,
  };
};
