import React, { useState } from "react";
import { SortField, SortDirection } from "../../types/file";
import { ArrowUp, ArrowDown } from "lucide-react";
import { DEFAULT_COLUMN_WIDTHS, useSettingsStore } from "../../store/settingsStore";
import { clsx } from "clsx";

interface ColumnHeaderProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  sortField,
  sortDirection,
  onSort,
}) => {
  const [resizingColumn, setResizingColumn] = useState<"size" | "date" | null>(null);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp size={12} className="ml-1 shrink-0" />
    ) : (
      <ArrowDown size={12} className="ml-1 shrink-0" />
    );
  };

  const handleResizeStart = (
    column: "size" | "date",
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const initialWidth =
      useSettingsStore.getState().columnWidths[column] ??
      DEFAULT_COLUMN_WIDTHS[column];

    setResizingColumn(column);

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      useSettingsStore.getState().setColumnWidth(column, initialWidth + deltaX);
    };

    const onMouseUp = () => {
      setResizingColumn(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleResizeDoubleClick = (
    column: "size" | "date",
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    useSettingsStore.getState().setColumnWidth(column, DEFAULT_COLUMN_WIDTHS[column]);
  };

  return (
    <div
      className={clsx(
        "flex bg-bg-secondary border-b border-border-color h-6 items-center flex-none select-none",
        resizingColumn && "cursor-col-resize"
      )}
    >
      <div
        onClick={() => onSort("name")}
        className="flex-1 px-2 border-r border-border-color text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 flex items-center min-w-0 overflow-hidden"
      >
        Name
        {renderSortIcon("name")}
      </div>

      <div
        onClick={() => onSort("size")}
        style={{ width: "var(--col-size-width, 96px)" }}
        className="px-2 border-r border-border-color text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 text-right flex items-center justify-end shrink-0 relative group"
      >
        Size
        {renderSortIcon("size")}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Size Column"
          title="Drag to resize, double click to reset"
          onMouseDown={(e) => handleResizeStart("size", e)}
          onDoubleClick={(e) => handleResizeDoubleClick("size", e)}
          onClick={(e) => e.stopPropagation()}
          className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-accent-color/60 active:bg-accent-color transition-colors"
        />
      </div>

      <div
        onClick={() => onSort("date")}
        style={{ width: "var(--col-date-width, 144px)" }}
        className="px-2 text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 flex items-center shrink-0 relative group"
      >
        Date
        {renderSortIcon("date")}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Date Column"
          title="Drag to resize, double click to reset"
          onMouseDown={(e) => handleResizeStart("date", e)}
          onDoubleClick={(e) => handleResizeDoubleClick("date", e)}
          onClick={(e) => e.stopPropagation()}
          className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-accent-color/60 active:bg-accent-color transition-colors"
        />
      </div>
    </div>
  );
};
