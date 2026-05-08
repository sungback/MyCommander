import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSettingsStore } from "../../store/settingsStore";

interface UseFileListVirtualizerOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cursorIndex: number;
  isActivePanel: boolean;
  rowCount: number;
  setCursorIndex: (idx: number) => void;
}

export function useFileListVirtualizer({
  containerRef,
  cursorIndex,
  isActivePanel,
  rowCount,
  setCursorIndex,
}: UseFileListVirtualizerOptions) {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const rowHeight = Math.max(24, fontSize * 2);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  useEffect(() => {
    if (isActivePanel && cursorIndex >= 0 && cursorIndex < rowCount) {
      virtualizerRef.current.scrollToIndex(cursorIndex, { align: "auto" });
    }
  }, [cursorIndex, isActivePanel, rowCount]);

  useEffect(() => {
    if (rowCount === 0) return;
    if (cursorIndex >= rowCount) {
      setCursorIndex(rowCount - 1);
    }
  }, [cursorIndex, rowCount, setCursorIndex]);

  return { rowVirtualizer };
}
