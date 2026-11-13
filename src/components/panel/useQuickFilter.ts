import { useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../../types/file";
import {
  filterEntriesByQuickFilter,
  normalizeQuickFilterQuery,
} from "./quickFilter";

interface UseQuickFilterArgs {
  panelId: "left" | "right";
  files: FileEntry[];
  currentPath: string;
  selectedItems: Set<string>;
  cursorIndex: number;
  setActivePanel: (panelId: "left" | "right") => void;
  setCursor: (panelId: "left" | "right", index: number) => void;
  setSelection: (panelId: "left" | "right", paths: string[]) => void;
}

export const useQuickFilter = ({
  panelId,
  files,
  currentPath,
  selectedItems,
  cursorIndex,
  setActivePanel,
  setCursor,
  setSelection,
}: UseQuickFilterArgs) => {
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const isQuickFilterActive = normalizeQuickFilterQuery(query).length > 0;
  const filteredFiles = useMemo(
    () => filterEntriesByQuickFilter(files, query),
    [files, query]
  );
  const totalFilterableFiles = useMemo(
    () => files.filter((entry) => entry.name !== "..").length,
    [files]
  );

  useEffect(() => {
    setQuery("");
  }, [currentPath]);

  useEffect(() => {
    if (!isQuickFilterActive) {
      return;
    }

    const visiblePaths = new Set(filteredFiles.map((entry) => entry.path));
    const selectedPaths = Array.from(selectedItems);
    const nextSelection = selectedPaths.filter((path) => visiblePaths.has(path));

    if (nextSelection.length !== selectedPaths.length) {
      setSelection(panelId, nextSelection);
    }
  }, [filteredFiles, panelId, isQuickFilterActive, selectedItems, setSelection]);

  useEffect(() => {
    if (filteredFiles.length === 0 && cursorIndex !== 0) {
      setCursor(panelId, 0);
      return;
    }

    if (cursorIndex >= filteredFiles.length) {
      setCursor(panelId, Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, panelId, cursorIndex, setCursor]);

  const handleQuickFilterChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setCursor(panelId, 0);
  };

  const handleClearQuickFilter = () => {
    setQuery("");
    setCursor(panelId, 0);
    filterInputRef.current?.focus({ preventScroll: true });
  };

  const focusQuickFilter = () => {
    setActivePanel(panelId);
    filterInputRef.current?.focus({ preventScroll: true });
    filterInputRef.current?.select();
  };

  return {
    filterInputRef,
    quickFilterQuery: query,
    isQuickFilterActive,
    filteredFiles,
    totalFilterableFiles,
    handleQuickFilterChange,
    handleClearQuickFilter,
    focusQuickFilter,
  };
};
