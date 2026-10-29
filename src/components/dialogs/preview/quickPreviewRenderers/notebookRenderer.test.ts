import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHighlightSnippet = vi.fn();

vi.mock("./textHighlighter", () => ({
  defaultLoadTextHighlighter: () =>
    Promise.resolve({
      highlightSnippet: mockHighlightSnippet,
    }),
}));

describe("defaultLoadNotebookRenderer", () => {
  beforeEach(() => {
    mockHighlightSnippet.mockReset();
    mockHighlightSnippet.mockResolvedValue({
      highlightedHtml: '<span class="hljs-keyword">print</span>("hello")',
      language: "python",
    });
    document.documentElement.dataset.theme = "dark";
  });

  it("returns a fallback message for invalid notebook json", async () => {
    const { defaultLoadNotebookRenderer } = await import("./notebookRenderer");
    const renderer = await defaultLoadNotebookRenderer();

    const html = await renderer.renderNotebook("{not json");

    expect(html).toContain("Failed to parse notebook JSON");
  });

  it("renders markdown, code, and stream output cells", async () => {
    const { defaultLoadNotebookRenderer } = await import("./notebookRenderer");
    const renderer = await defaultLoadNotebookRenderer();

    const html = await renderer.renderNotebook(
      JSON.stringify({
        metadata: { kernelspec: { language: "python" } },
        cells: [
          { cell_type: "markdown", source: ["# Notebook title"] },
          {
            cell_type: "code",
            source: ['print("hello")'],
            execution_count: 3,
            outputs: [{ output_type: "stream", text: ["hello\n"] }],
          },
        ],
      })
    );

    expect(mockHighlightSnippet).toHaveBeenCalledWith('print("hello")', "python");
    expect(html).toContain("<h1>Notebook title</h1>");
    expect(html).toContain('[3]:');
    expect(html).toContain('<span class="hljs-keyword">print</span>("hello")');
    expect(html).toContain('hello\n');
  });
});
