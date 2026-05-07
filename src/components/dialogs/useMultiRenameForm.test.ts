import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultMultiRenameOptions } from "../../features/multiRename";
import { useMultiRenameForm } from "./useMultiRenameForm";

describe("useMultiRenameForm", () => {
  it("starts with default options and idle submit state", () => {
    const { result } = renderHook(() => useMultiRenameForm());

    expect(result.current.options).toEqual(defaultMultiRenameOptions);
    expect(result.current.operationError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("updates individual options without dropping the rest of the form", () => {
    const { result } = renderHook(() => useMultiRenameForm());

    act(() => {
      result.current.updateOption("nameMask", "photo_[C]");
      result.current.updateOption("counterPadding", 3);
    });

    expect(result.current.options).toEqual({
      ...defaultMultiRenameOptions,
      nameMask: "photo_[C]",
      counterPadding: 3,
    });
  });

  it("resets options, error, and submit state together", () => {
    const { result } = renderHook(() => useMultiRenameForm());

    act(() => {
      result.current.updateOption("extensionMask", "jpg");
      result.current.setOperationError("failed");
      result.current.setIsSubmitting(true);
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.options).toEqual(defaultMultiRenameOptions);
    expect(result.current.operationError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });
});
