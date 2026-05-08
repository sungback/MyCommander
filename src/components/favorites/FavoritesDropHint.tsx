import React from "react";
import { clsx } from "clsx";

interface FavoritesDropHintProps {
  canDropDraggedFolders: boolean;
  variant: "rail" | "panel";
}

export const FavoritesDropHint: React.FC<FavoritesDropHintProps> = ({
  canDropDraggedFolders,
  variant,
}) => {
  const isRail = variant === "rail";

  return (
    <div
      className={clsx(
        "pointer-events-none rounded border font-semibold",
        canDropDraggedFolders
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
          : "border-red-400/60 bg-red-500/15 text-red-300",
        isRail
          ? "absolute inset-x-1 bottom-2 px-1 py-1 text-center text-[10px] leading-tight"
          : "mx-2 mt-2 px-2 py-1.5 text-[11px]"
      )}
    >
      {isRail
        ? canDropDraggedFolders
          ? "추가"
          : "불가"
        : canDropDraggedFolders
          ? "여기에 놓으면 즐겨찾기에 추가됩니다."
          : "폴더만 즐겨찾기에 추가할 수 있습니다."}
    </div>
  );
};
