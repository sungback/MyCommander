import React from "react";
import { SortField, SortDirection } from "../../types/file";
import { ArrowUp, ArrowDown } from "lucide-react";

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
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp size={12} className="ml-1 shrink-0" />
    ) : (
      <ArrowDown size={12} className="ml-1 shrink-0" />
    );
  };

  return (
    <div className="flex bg-bg-secondary border-b border-border-color h-6 items-center flex-none">
      <div
        onClick={() => onSort("name")}
        className="flex-1 px-2 border-r border-border-color text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 flex items-center"
      >
        Name
        {renderSortIcon("name")}
      </div>

      <div
        onClick={() => onSort("size")}
        className="w-24 px-2 border-r border-border-color text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 text-right flex items-center justify-end"
      >
        Size
        {renderSortIcon("size")}
      </div>
      <div
        onClick={() => onSort("date")}
        className="w-36 px-2 text-xs text-text-secondary font-semibold hover:bg-bg-hover cursor-pointer transition-colors active:opacity-80 flex items-center"
      >
        Date
        {renderSortIcon("date")}
      </div>
    </div>
  );
};
