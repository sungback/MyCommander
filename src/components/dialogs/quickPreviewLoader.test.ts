import { describe, expect, it, vi } from "vitest";
import { loadPreviewForPath } from "./quickPreviewLoader";

describe("loadPreviewForPath", () => {
  it("returns image previews without loading heavyweight renderers", async () => {
    const loadTextHighlighter = vi.fn();
    const loadMarkdownRenderer = vi.fn();
    const loadNotebookRenderer = vi.fn();
    const loadPptxRenderer = vi.fn();
    const loadHwpxRenderer = vi.fn();
    const loadXlsxRenderer = vi.fn();

    const result = await loadPreviewForPath("/tmp/photo.png", {
      convertFileSrcImpl: (path) => `asset://${path}`,
      loadTextHighlighter,
      loadMarkdownRenderer,
      loadNotebookRenderer,
      loadPptxRenderer,
      loadHwpxRenderer,
      loadXlsxRenderer,
    });

    expect(result).toEqual({
      type: "image",
      src: "asset:///tmp/photo.png",
    });
    expect(loadTextHighlighter).not.toHaveBeenCalled();
    expect(loadMarkdownRenderer).not.toHaveBeenCalled();
    expect(loadNotebookRenderer).not.toHaveBeenCalled();
    expect(loadPptxRenderer).not.toHaveBeenCalled();
    expect(loadHwpxRenderer).not.toHaveBeenCalled();
    expect(loadXlsxRenderer).not.toHaveBeenCalled();
  });

  it("loads the text highlighter only for text previews", async () => {
    const highlightText = vi.fn().mockResolvedValue({
      highlightedHtml: "<span>const a = 1;</span>",
      language: "javascript",
    });
    const loadTextHighlighter = vi.fn().mockResolvedValue({ highlightText });
    const invokeImpl = vi.fn().mockResolvedValue("const a = 1;");

    const result = await loadPreviewForPath("/tmp/file.js", {
      invokeImpl,
      loadTextHighlighter,
      loadMarkdownRenderer: vi.fn(),
      loadNotebookRenderer: vi.fn(),
      loadPptxRenderer: vi.fn(),
      loadHwpxRenderer: vi.fn(),
      loadXlsxRenderer: vi.fn(),
    });

    expect(invokeImpl).toHaveBeenCalledWith("read_file_content", { path: "/tmp/file.js" });
    expect(loadTextHighlighter).toHaveBeenCalledTimes(1);
    expect(highlightText).toHaveBeenCalledWith("const a = 1;", "js");
    expect(result).toEqual({
      type: "text",
      content: "const a = 1;",
      highlightedHtml: "<span>const a = 1;</span>",
      language: "javascript",
    });
  });

  it("treats .R files as text previews with the r language hint", async () => {
    const highlightText = vi.fn().mockResolvedValue({
      highlightedHtml: "<span>plot(x, y)</span>",
      language: "r",
    });
    const loadTextHighlighter = vi.fn().mockResolvedValue({ highlightText });
    const invokeImpl = vi.fn().mockResolvedValue("plot(x, y)");

    const result = await loadPreviewForPath("/tmp/script.R", {
      invokeImpl,
      loadTextHighlighter,
      loadMarkdownRenderer: vi.fn(),
      loadNotebookRenderer: vi.fn(),
      loadPptxRenderer: vi.fn(),
      loadHwpxRenderer: vi.fn(),
      loadXlsxRenderer: vi.fn(),
      loadDocxRenderer: vi.fn(),
    });

    expect(invokeImpl).toHaveBeenCalledWith("read_file_content", { path: "/tmp/script.R" });
    expect(loadTextHighlighter).toHaveBeenCalledTimes(1);
    expect(highlightText).toHaveBeenCalledWith("plot(x, y)", "r");
    expect(result).toEqual({
      type: "text",
      content: "plot(x, y)",
      highlightedHtml: "<span>plot(x, y)</span>",
      language: "r",
    });
  });

  it("loads the markdown renderer only for markdown previews", async () => {
    const renderMarkdown = vi.fn().mockResolvedValue("<html><body><h1>Doc</h1></body></html>");
    const loadMarkdownRenderer = vi.fn().mockResolvedValue({ renderMarkdown });
    const invokeImpl = vi.fn().mockResolvedValue("# Doc");

    const result = await loadPreviewForPath("/tmp/readme.md", {
      invokeImpl,
      loadTextHighlighter: vi.fn(),
      loadMarkdownRenderer,
      loadNotebookRenderer: vi.fn(),
      loadPptxRenderer: vi.fn(),
      loadHwpxRenderer: vi.fn(),
      loadXlsxRenderer: vi.fn(),
    });

    expect(loadMarkdownRenderer).toHaveBeenCalledTimes(1);
    expect(renderMarkdown).toHaveBeenCalledWith("# Doc");
    expect(result).toEqual({
      type: "rendered",
      content: "# Doc",
      renderedHtml: "<html><body><h1>Doc</h1></body></html>",
      renderExt: "markdown",
    });
  });

  it("loads the spreadsheet renderer only for xlsx previews", async () => {
    const renderXlsx = vi.fn().mockResolvedValue("<html><body>sheet</body></html>");
    const loadXlsxRenderer = vi.fn().mockResolvedValue({ renderXlsx });

    const result = await loadPreviewForPath("/tmp/book.xlsx", {
      loadTextHighlighter: vi.fn(),
      loadMarkdownRenderer: vi.fn(),
      loadNotebookRenderer: vi.fn(),
      loadPptxRenderer: vi.fn(),
      loadHwpxRenderer: vi.fn(),
      loadXlsxRenderer,
    });

    expect(loadXlsxRenderer).toHaveBeenCalledTimes(1);
    expect(renderXlsx).toHaveBeenCalledWith("/tmp/book.xlsx");
    expect(result).toEqual({
      type: "rendered",
      renderedHtml: "<html><body>sheet</body></html>",
      renderExt: "xlsx",
    });
  });

  it("loads the docx renderer only for docx previews", async () => {
    const renderDocx = vi.fn().mockResolvedValue("<html><body>docx</body></html>");
    const loadDocxRenderer = vi.fn().mockResolvedValue({ renderDocx });

    const result = await loadPreviewForPath("/tmp/report.docx", {
      loadTextHighlighter: vi.fn(),
      loadMarkdownRenderer: vi.fn(),
      loadNotebookRenderer: vi.fn(),
      loadPptxRenderer: vi.fn(),
      loadHwpxRenderer: vi.fn(),
      loadXlsxRenderer: vi.fn(),
      loadDocxRenderer,
    });

    expect(loadDocxRenderer).toHaveBeenCalledTimes(1);
    expect(renderDocx).toHaveBeenCalledWith("/tmp/report.docx");
    expect(result).toEqual({
      type: "rendered",
      renderedHtml: "<html><body>docx</body></html>",
      renderExt: "docx",
    });
  });
});
