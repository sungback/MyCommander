import React from "react";
import { Clock3, TrendingUp, X } from "lucide-react";
import type { LocationHistoryEntry } from "../../store/locationHistoryStore";

interface LocationHistoryRowProps {
  location: LocationHistoryEntry;
  variant: "frequent" | "recent";
  onNavigate: (path: string) => void;
  onRemove: (path: string) => void;
}

export const LocationHistoryRow: React.FC<LocationHistoryRowProps> = ({
  location,
  variant,
  onNavigate,
  onRemove,
}) => {
  const Icon = variant === "frequent" ? TrendingUp : Clock3;

  return (
    <div className="group flex items-center gap-1 px-1.5 py-1 transition-colors hover:bg-bg-hover">
      <button
        type="button"
        onClick={() => onNavigate(location.path)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        title={location.path}
      >
        <Icon size={12} className="shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs leading-4 text-text-primary">
            {location.name}
          </span>
          <span className="block truncate text-[10px] leading-3 text-text-secondary">
            {location.path}
          </span>
        </span>
        {variant === "frequent" ? (
          <span className="shrink-0 rounded border border-border-color px-1 py-0.5 font-mono text-[10px] text-text-secondary">
            {location.visitCount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onRemove(location.path)}
        className="shrink-0 p-0.5 text-text-secondary opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100"
        title="위치 기록 제거"
      >
        <X size={11} />
      </button>
    </div>
  );
};
