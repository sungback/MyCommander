import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Star, X } from "lucide-react";
import { clsx } from "clsx";
import { useFavoriteStore, Favorite } from "../../store/favoriteStore";
import { usePanelStore } from "../../store/panelStore";
import { useDragStore } from "../../store/dragStore";
import { useUiStore } from "../../store/uiStore";

let clearStatusMessageTimeoutId: number | undefined;

const showTransientStatusMessage = (message: string, durationMs: number = 1800) => {
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

export const FavoritesPanel: React.FC = () => {
  const favorites = useFavoriteStore((s) => s.favorites);
  const addFavorite = useFavoriteStore((s) => s.addFavorite);
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const reorderFavorites = useFavoriteStore((s) => s.reorderFavorites);
  const showFavoritesPanel = useUiStore((s) => s.showFavoritesPanel);
  const toggleFavoritesPanel = useUiStore((s) => s.toggleFavoritesPanel);
  const activePanel = usePanelStore((s) => s.activePanel);
  const dragInfo = useDragStore((s) => s.dragInfo);
  const setPath = usePanelStore((s) => s.setPath);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDraggedFolderOverPanel, setIsDraggedFolderOverPanel] = useState(false);
  const dragIdRef = useRef<string | null>(null);
  const isDraggedFolderOverPanelRef = useRef(false);

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
        showTransientStatusMessage("폴더만 즐겨찾기에 추가할 수 있습니다.");
        return;
      }

      const existingPaths = new Set(useFavoriteStore.getState().favorites.map((favorite) => favorite.path));
      const uniquePaths = Array.from(new Set(draggedDirectoryPaths)).filter(
        (path) => !existingPaths.has(path)
      );

      if (uniquePaths.length === 0) {
        showTransientStatusMessage("이미 즐겨찾기에 등록된 폴더입니다.");
        return;
      }

      uniquePaths.forEach((path) => addFavorite(path));
      showTransientStatusMessage(
        uniquePaths.length === 1
          ? "즐겨찾기에 폴더를 추가했습니다."
          : `즐겨찾기에 폴더 ${uniquePaths.length}개를 추가했습니다.`
      );
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [addFavorite, canDropDraggedFolders, dragInfo, draggedDirectoryPaths]);

  const handleNavigate = (path: string) => {
    setPath(activePanel, path);
  };

  const handleAddCurrent = () => {
    const state = usePanelStore.getState();
    const panel =
      state.activePanel === "left" ? state.leftPanel : state.rightPanel;
    addFavorite(panel.currentPath);
  };

  const startEdit = (fav: Favorite) => {
    setEditingId(fav.id);
    setEditName(fav.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      renameFavorite(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const sorted = [...favorites].sort((a, b) => a.order - b.order);

  // Collapsed state — show slim icon rail
  if (!showFavoritesPanel) {
    return (
      <div
        ref={panelRef}
        data-testid="favorites-panel"
        className={clsx(
          "relative flex flex-col items-center w-8 bg-bg-secondary border-r border-border-color shrink-0 py-2 transition-colors",
          {
            "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/60":
              isDraggedFolderOverPanel && canDropDraggedFolders,
            "bg-red-500/10 ring-1 ring-inset ring-red-400/60":
              isDraggedFolderOverPanel && isInvalidExternalDrop,
          }
        )}
      >
        <button
          onClick={toggleFavoritesPanel}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          title="즐겨찾기 열기"
        >
          <ChevronRight size={16} />
        </button>
        <Star size={14} className="mt-1 text-text-secondary opacity-50" />
        {isDraggedFolderOverPanel ? (
          <div
            className={clsx(
              "pointer-events-none absolute inset-x-1 bottom-2 rounded border px-1 py-1 text-center text-[10px] font-semibold leading-tight",
              canDropDraggedFolders
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                : "border-red-400/60 bg-red-500/15 text-red-300"
            )}
          >
            {canDropDraggedFolders ? "추가" : "불가"}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      data-testid="favorites-panel"
      className={clsx(
        "relative flex flex-col w-44 bg-bg-secondary border-r border-border-color shrink-0 h-full overflow-hidden transition-colors",
        {
          "bg-emerald-500/8 ring-1 ring-inset ring-emerald-400/50":
            isDraggedFolderOverPanel && canDropDraggedFolders,
          "bg-red-500/8 ring-1 ring-inset ring-red-400/50":
            isDraggedFolderOverPanel && isInvalidExternalDrop,
        }
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border-color shrink-0">
        <div className="flex items-center gap-1 text-xs font-medium text-text-secondary uppercase tracking-wide">
          <Star size={12} />
          <span>즐겨찾기</span>
        </div>
        <button
          onClick={toggleFavoritesPanel}
          className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
          title="접기"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {isDraggedFolderOverPanel ? (
        <div
          className={clsx(
            "mx-2 mt-2 rounded border px-2 py-1.5 text-[11px] font-semibold",
            canDropDraggedFolders
              ? "border-emerald-400/60 bg-emerald-500/12 text-emerald-300"
              : "border-red-400/60 bg-red-500/12 text-red-300"
          )}
        >
          {canDropDraggedFolders
            ? "여기에 놓으면 즐겨찾기에 추가됩니다."
            : "폴더만 즐겨찾기에 추가할 수 있습니다."}
        </div>
      ) : null}

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {sorted.length === 0 && (
          <p className="text-xs text-text-secondary px-3 py-2 leading-relaxed">
            즐겨찾기가 없습니다.{"\n"}아래 버튼으로 추가하세요.
          </p>
        )}

        {sorted.map((fav) => (
          <div
            key={fav.id}
            draggable
            onDragStart={() => {
              dragIdRef.current = fav.id;
            }}
            onDragEnd={() => {
              dragIdRef.current = null;
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(fav.id);
            }}
            onDrop={() => {
              if (dragIdRef.current && dragIdRef.current !== fav.id) {
                reorderFavorites(dragIdRef.current, fav.id);
              }
              setDragOverId(null);
            }}
            className={clsx(
              "group flex items-center gap-1 px-1.5 py-1 transition-colors",
              dragOverId === fav.id
                ? "border-t-2 border-accent-color bg-bg-hover"
                : "hover:bg-bg-hover"
            )}
          >
            {/* Drag handle */}
            <GripVertical
              size={12}
              className="text-text-secondary opacity-0 group-hover:opacity-50 shrink-0 cursor-grab"
            />

            {/* Name / edit input */}
            {editingId === fav.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 text-xs bg-bg-panel border border-accent-color rounded px-1 py-0.5 text-text-primary outline-none min-w-0"
              />
            ) : (
              <button
                onClick={() => handleNavigate(fav.path)}
                className="flex-1 text-left text-xs text-text-primary truncate min-w-0 leading-5"
                title={fav.path}
              >
                {fav.name}
              </button>
            )}

            {/* Action buttons (visible on hover) */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
              {editingId === fav.id ? (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitEdit}
                  className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
                  title="저장"
                >
                  <Check size={11} />
                </button>
              ) : (
                <button
                  onClick={() => startEdit(fav)}
                  className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
                  title="이름 변경"
                >
                  <Pencil size={11} />
                </button>
              )}
              <button
                onClick={() => removeFavorite(fav.id)}
                className="p-0.5 text-text-secondary hover:text-red-400 transition-colors"
                title="제거"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add current path */}
      <div className="border-t border-border-color p-2 shrink-0">
        <button
          onClick={handleAddCurrent}
          className="flex items-center gap-1.5 w-full text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-bg-hover transition-colors"
          title="현재 경로를 즐겨찾기에 추가 (Ctrl+D)"
        >
          <Plus size={12} />
          <span>현재 경로 추가</span>
        </button>
      </div>
    </div>
  );
};
