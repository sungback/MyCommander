import { describe, expect, it } from "vitest";
import {
  createDefaultSearchOptions,
  formatDateInput,
  formatExtensionsInput,
  parseDateEndMs,
  parseDateStartMs,
  parseExtensionsInput,
  parseOptionalNumberInput,
} from "./searchOptions";

describe("searchOptions helpers", () => {
  it("creates backward-compatible defaults", () => {
    expect(createDefaultSearchOptions()).toEqual({
      query: "",
      useRegex: false,
      caseSensitive: true,
      includeHidden: true,
      scope: "name",
      entryKind: "all",
      extensions: [],
      minSizeBytes: null,
      maxSizeBytes: null,
      modifiedAfterMs: null,
      modifiedBeforeMs: null,
      maxResults: 5000,
    });
  });

  it("parses extension input into normalized tokens", () => {
    expect(parseExtensionsInput(" .TXT, md , , .Rs ")).toEqual(["txt", "md", "rs"]);
    expect(formatExtensionsInput(["txt", "md", "rs"])).toBe("txt, md, rs");
  });

  it("parses optional numeric input safely", () => {
    expect(parseOptionalNumberInput("")).toBeNull();
    expect(parseOptionalNumberInput("1024")).toBe(1024);
    expect(parseOptionalNumberInput("-4")).toBeNull();
    expect(parseOptionalNumberInput("abc")).toBeNull();
  });

  it("converts date strings to inclusive day boundaries", () => {
    expect(parseDateStartMs("2026-04-22")).toBe(new Date("2026-04-22T00:00:00.000").getTime());
    expect(parseDateEndMs("2026-04-22")).toBe(new Date("2026-04-22T23:59:59.999").getTime());
    expect(formatDateInput(new Date("2026-04-22T15:00:00.000Z").getTime())).toBe("2026-04-22");
  });
});
