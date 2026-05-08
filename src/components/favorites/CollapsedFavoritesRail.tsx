import React from "react";
import { ChevronRight, Star } from "lucide-react";
import { clsx } from "clsx";
import { FavoritesDropHint } from "./FavoritesDropHint";

interface CollapsedFavoritesRailProps {
  panelRef: React.Ref<HTMLDivElement>;
  isDraggedFolderOverPanel: boolean;
  canDropDraggedFolders: boolean;
  isInvalidExternalDrop: boolean;
  onToggle: () => void;
}

export const CollapsedFavoritesRail: React.FC<CollapsedFavoritesRailProps> = ({
  panelRef,
  isDraggedFolderOverPanel,
  canDropDraggedFolders,
  isInvalidExternalDrop,
  onToggle,
}) => (
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
      onClick={onToggle}
      className="p-1 text-text-secondary hover:text-text-primary transition-colors"
      title="즐겨찾기 열기"
    >
      <ChevronRight size={16} />
    </button>
    <Star size={14} className="mt-1 text-text-secondary opacity-50" />
    {isDraggedFolderOverPanel ? (
      <FavoritesDropHint canDropDraggedFolders={canDropDraggedFolders} variant="rail" />
    ) : null}
  </div>
);
