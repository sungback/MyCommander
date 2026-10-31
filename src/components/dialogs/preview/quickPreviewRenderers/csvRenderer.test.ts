import { describe, expect, it } from "vitest";
import { buildCsvHtml, parseCsv } from "./csvRenderer";

describe("csvRenderer", () => {
  it("parses quoted delimiters, newlines and escaped quotes", () => {
    expect(parseCsv('a,"b,c","d\ne"\r\n"f""g",,h', ",")).toEqual([
      ["a", "b,c", "d\ne"],
      ['f"g', "", "h"],
    ]);
  });

  it("strips BOM and uses tab for tsv", () => {
    expect(parseCsv("﻿a\tb\n1\t2\n", "\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("renders header and escaped cells as a table", () => {
    const html = buildCsvHtml("type,text\npost,<b>x</b>", "csv");
    expect(html).toContain("<th>type</th>");
    expect(html).toContain("<td>&lt;b&gt;x&lt;/b&gt;</td>");
  });

  it("caps rows and columns and notes the cut", () => {
    const wide = Array.from({ length: 150 }, (_, i) => `c${i}`).join(",");
    const html = buildCsvHtml(Array.from({ length: 600 }, () => wide).join("\n"), "csv");
    expect(html).toContain("처음 500행, 처음 100열만 표시됩니다");
    expect(html).toContain("<th>c99</th>");
    expect(html).not.toContain("<th>c100</th>");
    expect(parseCsv("a\nb\nc", ",", 2)).toEqual([["a"], ["b"]]);
  });
});
