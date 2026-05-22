import { afterEach, describe, expect, it } from "vitest";
import { defaultLoadMarkdownRenderer } from "./markdownRenderer";

describe("defaultLoadMarkdownRenderer", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("renders markdown html with light theme styles", async () => {
    document.documentElement.dataset.theme = "light";
    const renderer = await defaultLoadMarkdownRenderer();

    const html = await renderer.renderMarkdown("# Title\n\n[Docs](https://example.com)\n\n`code`");

    expect(html).toContain("background: #ffffff");
    expect(html).toContain("color: #1f2328");
    expect(html).toContain("color: #0969da");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain('<a href="https://example.com">Docs</a>');
    expect(html).toContain("<code>code</code>");
  });

  it("renders markdown html with dark theme styles", async () => {
    document.documentElement.dataset.theme = "dark";
    const renderer = await defaultLoadMarkdownRenderer();

    const html = await renderer.renderMarkdown("> note");

    expect(html).toContain("background: #0d1117");
    expect(html).toContain("color: #e6edf3");
    expect(html).toContain("color: #58a6ff");
    expect(html).toContain("<blockquote>");
  });
});
