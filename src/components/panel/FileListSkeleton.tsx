import React from "react";

const SKELETON_ROW_COUNT = 10;

export const FileListSkeleton: React.FC = () => (
  <div className="flex flex-col w-full px-1 py-0.5 gap-0.5" aria-hidden="true">
    {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-2 px-2 rounded"
        style={{ height: "var(--app-row-height, 28px)" }}
      >
        <div
          className="shrink-0 rounded bg-text-primary/10 animate-pulse"
          style={{ width: 16, height: 16 }}
        />
        <div
          className="rounded bg-text-primary/10 animate-pulse"
          style={{
            height: 12,
            width: `${40 + ((i * 37) % 40)}%`,
          }}
        />
      </div>
    ))}
  </div>
);
