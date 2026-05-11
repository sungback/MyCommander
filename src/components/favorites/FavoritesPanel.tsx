import React, { useState } from "react";
import { ChevronLeft, Clock3, HardDrive, Plus, Star, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { useFavoriteStore, Favorite } from "../../store/favoriteStore";
import {
  getFrequentLocations,
  getRecentLocations,
  useLocationHistoryStore,
} from "../../store/locationHistoryStore";
import { usePanelStore } from "../../store/panelStore";
import { useUiStore } from "../../store/uiStore";
import { CollapsedFavoritesRail } from "./CollapsedFavoritesRail";
import { FavoriteRow } from "./FavoriteRow";
import { FavoritesDropHint } from "./FavoritesDropHint";
import { LocationHistoryRow } from "./LocationHistoryRow";
import { useFavoritesPanelDrop } from "./useFavoritesPanelDrop";
import { MAC_ROOT_DISPLAY_NAME } from "../../utils/pathDisplay";
import { isMacPlatform } from "../../utils/platform";

export const FavoritesPanel: React.FC = () => {
  const favorites = useFavoriteStore((s) => s.favorites);
  const addFavorite = useFavoriteStore((s) => s.addFavorite);
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);
  const renameFavorite = useFavoriteStore((s) => s.renameFavorite);
  const reorderFavorites = useFavoriteStore((s) => s.reorderFavorites);
  const locations = useLocationHistoryStore((s) => s.locations);
  const removeLocation = useLocationHistoryStore((s) => s.removeLocation);
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
  const frequentLocations = getFrequentLocations(locations, 4);
  const frequentPaths = new Set(frequentLocations.map((location) => location.path));
  const recentLocations = getRecentLocations(locations, 8)
    .filter((location) => !frequentPaths.has(location.path))
    .slice(0, 6);
  const showMacintoshHdLocation = isMacPlatform();

  const renderLocationSection = (
    title: string,
    locationsToRender: typeof locations,
    variant: "frequent" | "recent"
  ) => {
    if (locationsToRender.length === 0) {
      return null;
    }

    const Icon = variant === "frequent" ? TrendingUp : Clock3;

    return (
      <section className="border-t border-border-color/70 py-1">
        <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          <Icon size={11} />
          <span>{title}</span>
        </div>
        {locationsToRender.map((location) => (
          <LocationHistoryRow
            key={`${variant}:${location.path}`}
            location={location}
            variant={variant}
            onNavigate={handleNavigate}
            onRemove={removeLocation}
          />
        ))}
      </section>
    );
  };

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
        {showMacintoshHdLocation ? (
          <section className="border-b border-border-color/70 pb-1">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className="group flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              title={MAC_ROOT_DISPLAY_NAME}
            >
              <HardDrive size={12} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{MAC_ROOT_DISPLAY_NAME}</span>
            </button>
          </section>
        ) : null}

        <section className="pb-1">
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
        </section>

        {renderLocationSection("자주 쓰는 위치", frequentLocations, "frequent")}
        {renderLocationSection("최근 위치", recentLocations, "recent")}
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
