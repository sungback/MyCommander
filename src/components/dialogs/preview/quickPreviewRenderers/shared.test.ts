import { describe, expect, it } from "vitest";
import {
  ansiToHtml,
  buildPreviewHtmlDocument,
  escapeHtml,
  getAppTheme,
  getPreviewTheme,
  joinSource,
} from "./shared";

describe("quick preview shared helpers", () => {
  it("joins string arrays without extra separators", () => {
    expect(joinSource(["Hello", " ", "World"])).toBe("Hello World");
    expect(joinSource("single")).toBe("single");
  });

  it("escapes html-sensitive characters", () => {
    expect(escapeHtml(`<tag attr="x">&`)).toBe('&lt;tag attr="x"&gt;&amp;');
  });

  it("strips ansi color sequences after escaping html", () => {
    expect(ansiToHtml("\u001b[31m<error>\u001b[0m")).toBe("&lt;error&gt;");
  });

  it("reads the current app theme from the document dataset", () => {
    document.documentElement.dataset.theme = "light";
    expect(getAppTheme()).toBe("light");

    document.documentElement.dataset.theme = "dark";
    expect(getAppTheme()).toBe("dark");
  });

  it("returns shared preview colors for the active theme", () => {
    document.documentElement.dataset.theme = "light";
    expect(getPreviewTheme()).toMatchObject({
      isDark: false,
      background: "#ffffff",
      foreground: "#1f2328",
      border: "#d1d9e0",
      link: "#0969da",
    });

    document.documentElement.dataset.theme = "dark";
    expect(getPreviewTheme()).toMatchObject({
      isDark: true,
      background: "#0d1117",
      foreground: "#e6edf3",
      border: "#30363d",
      link: "#58a6ff",
    });
  });

  it("wraps body content and styles in a complete preview document", () => {
    expect(
      buildPreviewHtmlDocument({
        styles: "body { color: red; }",
        body: "<main>Preview</main>",
      })
    ).toBe(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
body { color: red; }
</style>
</head>
<body><main>Preview</main></body>
</html>`);
  });
});
