import React, { useState } from "react";
import { ChevronLeft, Plus, Star } from "lucide-react";
import { clsx } from "clsx";
import { useFavoriteStore, Favorite } from "../../store/favoriteStore";
import { usePanelStore } from "../../store/panelStore";
import { useUiStore } from "../../store/uiStore";
import { CollapsedFavoritesRail } from "./CollapsedFavoritesRail";
import { FavoriteRow } from "./FavoriteRow";
import { FavoritesDropHint } from "./FavoritesDropHint";
import { useFavoritesPanelDrop } from "./useFavoritesPanelDrop";

export const FavoritesPanel: React.FC = () => {
  const favorites = useFavoriteStore((s) => s.favorites);
  const addFavorite = useFavoriteStore((s) => s.addFavorite);
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const reorderFavorites = useFavoriteStore((s) => s.reorderFavorites);
  const showFavoritesPanel = useUiStore((s) => s.showFavoritesPanel);
  const toggleFavoritesPanel = useUiStore((s) => s.toggleFavoritesPanel);
  const activePanel = usePanelStore((s) => s.activePanel);
  const setPath = usePanelStore((s) => s.setPath);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const {
    panelRef,
    dragIdRef,
    isDraggedFolderOverPanel,
    canDropDraggedFolders,
    isInvalidExternalDrop,
  } = useFavoritesPanelDrop();

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
      <CollapsedFavoritesRail
        panelRef={panelRef}
        isDraggedFolderOverPanel={isDraggedFolderOverPanel}
        canDropDraggedFolders={canDropDraggedFolders}
        isInvalidExternalDrop={isInvalidExternalDrop}
        onToggle={toggleFavoritesPanel}
      />
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
        <FavoritesDropHint canDropDraggedFolders={canDropDraggedFolders} variant="panel" />
      ) : null}

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {sorted.length === 0 && (
          <p className="text-xs text-text-secondary px-3 py-2 leading-relaxed">
            즐겨찾기가 없습니다.{"\n"}아래 버튼으로 추가하세요.
          </p>
        )}

        {sorted.map((fav) => (
          <FavoriteRow
            key={fav.id}
            favorite={fav}
            editingId={editingId}
            editName={editName}
            dragOverId={dragOverId}
            dragIdRef={dragIdRef}
            onEditNameChange={setEditName}
            onCommitEdit={commitEdit}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onNavigate={handleNavigate}
            onRemove={removeFavorite}
            onReorder={reorderFavorites}
            onDragOverIdChange={setDragOverId}
          />
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
