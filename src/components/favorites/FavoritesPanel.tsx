import React, { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Star, X } from "lucide-react";
import { clsx } from "clsx";
import { useFavoriteStore, Favorite } from "../../store/favoriteStore";
import { usePanelStore } from "../../store/panelStore";
import { useUiStore } from "../../store/uiStore";

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
  const dragIdRef = useRef<string | null>(null);

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
      <div className="flex flex-col items-center w-8 bg-bg-secondary border-r border-border-color shrink-0 py-2">
        <button
          onClick={toggleFavoritesPanel}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          title="즐겨찾기 열기"
        >
          <ChevronRight size={16} />
        </button>
        <Star size={14} className="mt-1 text-text-secondary opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-44 bg-bg-secondary border-r border-border-color shrink-0 h-full overflow-hidden">
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
