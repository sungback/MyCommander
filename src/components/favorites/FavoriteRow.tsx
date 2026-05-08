import React from "react";
import { Check, GripVertical, Pencil, X } from "lucide-react";
import { clsx } from "clsx";
import type { Favorite } from "../../store/favoriteStore";

interface FavoriteRowProps {
  favorite: Favorite;
  editingId: string | null;
  editName: string;
  dragOverId: string | null;
  dragIdRef: React.MutableRefObject<string | null>;
  onEditNameChange: (value: string) => void;
  onCommitEdit: () => void;
  onStartEdit: (favorite: Favorite) => void;
  onCancelEdit: () => void;
  onNavigate: (path: string) => void;
  onRemove: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onDragOverIdChange: (id: string | null) => void;
}

export const FavoriteRow: React.FC<FavoriteRowProps> = ({
  favorite,
  editingId,
  editName,
  dragOverId,
  dragIdRef,
  onEditNameChange,
  onCommitEdit,
  onStartEdit,
  onCancelEdit,
  onNavigate,
  onRemove,
  onReorder,
  onDragOverIdChange,
}) => (
  <div
    draggable
    onDragStart={() => {
      dragIdRef.current = favorite.id;
    }}
    onDragEnd={() => {
      dragIdRef.current = null;
      onDragOverIdChange(null);
    }}
    onDragOver={(event) => {
      event.preventDefault();
      onDragOverIdChange(favorite.id);
    }}
    onDrop={() => {
      if (dragIdRef.current && dragIdRef.current !== favorite.id) {
        onReorder(dragIdRef.current, favorite.id);
      }
      onDragOverIdChange(null);
    }}
    className={clsx(
      "group flex items-center gap-1 px-1.5 py-1 transition-colors",
      dragOverId === favorite.id
        ? "border-t-2 border-accent-color bg-bg-hover"
        : "hover:bg-bg-hover"
    )}
  >
    <GripVertical
      size={12}
      className="text-text-secondary opacity-0 group-hover:opacity-50 shrink-0 cursor-grab"
    />

    {editingId === favorite.id ? (
      <input
        autoFocus
        value={editName}
        onChange={(event) => onEditNameChange(event.target.value)}
        onBlur={onCommitEdit}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommitEdit();
          if (event.key === "Escape") onCancelEdit();
        }}
        className="flex-1 text-xs bg-bg-panel border border-accent-color rounded px-1 py-0.5 text-text-primary outline-none min-w-0"
      />
    ) : (
      <button
        onClick={() => onNavigate(favorite.path)}
        className="flex-1 text-left text-xs text-text-primary truncate min-w-0 leading-5"
        title={favorite.path}
      >
        {favorite.name}
      </button>
    )}

    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
      {editingId === favorite.id ? (
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCommitEdit}
          className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
          title="저장"
        >
          <Check size={11} />
        </button>
      ) : (
        <button
          onClick={() => onStartEdit(favorite)}
          className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
          title="이름 변경"
        >
          <Pencil size={11} />
        </button>
      )}
      <button
        onClick={() => onRemove(favorite.id)}
        className="p-0.5 text-text-secondary hover:text-red-400 transition-colors"
        title="제거"
      >
        <X size={11} />
      </button>
    </div>
  </div>
);
