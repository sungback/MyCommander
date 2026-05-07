import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePersistentDialogSize } from "./usePersistentDialogSize";

const STORAGE_KEY = "test:dialog-size";
const DEFAULT_SIZE = { width: 700, height: 560 };

describe("usePersistentDialogSize", () => {
  it("loads the saved size from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width: 820, height: 640 }));

    const { result } = renderHook(() =>
      usePersistentDialogSize(STORAGE_KEY, DEFAULT_SIZE)
    );

    expect(result.current.dialogSize).toEqual({ width: 820, height: 640 });
  });

  it("falls back to the default size when saved data is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "{invalid");

    const { result } = renderHook(() =>
      usePersistentDialogSize(STORAGE_KEY, DEFAULT_SIZE)
    );

    expect(result.current.dialogSize).toEqual(DEFAULT_SIZE);
  });

  it("applies resize deltas and persists the new size", () => {
    const { result } = renderHook(() =>
      usePersistentDialogSize(STORAGE_KEY, DEFAULT_SIZE)
    );

    act(() => {
      result.current.resizeDialog({ width: 20, height: -10 });
    });

    expect(result.current.dialogSize).toEqual({ width: 720, height: 550 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      width: 720,
      height: 550,
    });
  });
});
