import { describe, expect, it } from "vitest";
import { ansiToHtml, escapeHtml, getAppTheme, joinSource } from "./shared";

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
});
