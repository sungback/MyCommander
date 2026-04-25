import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickPreviewState } from "./useQuickPreviewState";

const { mockLoadPreviewForPath, mockLoadSourceHighlightHtml } = vi.hoisted(() => ({
  mockLoadPreviewForPath: vi.fn(),
  mockLoadSourceHighlightHtml: vi.fn(),
}));

vi.mock("./quickPreviewLoader", () => ({
  loadPreviewForPath: mockLoadPreviewForPath,
  loadSourceHighlightHtml: mockLoadSourceHighlightHtml,
}));

describe("useQuickPreviewState", () => {
  beforeEach(() => {
    mockLoadPreviewForPath.mockReset();
    mockLoadSourceHighlightHtml.mockReset();
  });

  it("loads a preview when the dialog is open", async () => {
    mockLoadPreviewForPath.mockResolvedValue({
      type: "text",
      content: "hello",
    });

    const { result } = renderHook(() =>
      useQuickPreviewState({ isOpen: true, filePath: "/tmp/readme.txt" })
    );

    expect(result.current.preview).toEqual({ type: "loading" });

    await waitFor(() => {
      expect(result.current.preview).toEqual({
        type: "text",
        content: "hello",
      });
    });
    expect(mockLoadPreviewForPath).toHaveBeenCalledWith("/tmp/readme.txt");
  });

  it("turns load failures into error previews", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockLoadPreviewForPath.mockRejectedValue(new Error("cannot read"));

    const { result } = renderHook(() =>
      useQuickPreviewState({ isOpen: true, filePath: "/tmp/broken.txt" })
    );

    await waitFor(() => {
      expect(result.current.preview).toEqual({
        type: "error",
        error: "cannot read",
      });
    });

    consoleErrorSpy.mockRestore();
  });

  it("loads highlighted source only after source view is enabled", async () => {
    mockLoadPreviewForPath.mockResolvedValue({
      type: "rendered",
      content: "# Title",
      renderedHtml: "<h1>Title</h1>",
      renderExt: "markdown",
    });
    mockLoadSourceHighlightHtml.mockResolvedValue(
      '<span class="hljs-section"># Title</span>'
    );

    const { result } = renderHook(() =>
      useQuickPreviewState({ isOpen: true, filePath: "/tmp/readme.md" })
    );

    await waitFor(() => {
      expect(result.current.canToggleSource).toBe(true);
    });

    expect(mockLoadSourceHighlightHtml).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleSource();
    });

    await waitFor(() => {
      expect(result.current.sourceHighlightHtml).toBe(
        '<span class="hljs-section"># Title</span>'
      );
    });
    expect(mockLoadSourceHighlightHtml).toHaveBeenCalledWith("# Title", "markdown");
  });

  it("resets source state when the file path changes", async () => {
    mockLoadPreviewForPath.mockResolvedValue({
      type: "rendered",
      content: "# Title",
      renderedHtml: "<h1>Title</h1>",
      renderExt: "markdown",
    });
    mockLoadSourceHighlightHtml.mockResolvedValue("<span># Title</span>");

    const { rerender, result } = renderHook(
      ({ filePath }) => useQuickPreviewState({ isOpen: true, filePath }),
      { initialProps: { filePath: "/tmp/one.md" } }
    );

    await waitFor(() => {
      expect(result.current.canToggleSource).toBe(true);
    });

    act(() => {
      result.current.toggleSource();
    });

    await waitFor(() => {
      expect(result.current.sourceHighlightHtml).toBe("<span># Title</span>");
    });

    rerender({ filePath: "/tmp/two.md" });

    expect(result.current.showSource).toBe(false);
    expect(result.current.sourceHighlightHtml).toBeNull();
  });
});
