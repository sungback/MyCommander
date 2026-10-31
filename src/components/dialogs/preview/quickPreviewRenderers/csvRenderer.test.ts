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
});
