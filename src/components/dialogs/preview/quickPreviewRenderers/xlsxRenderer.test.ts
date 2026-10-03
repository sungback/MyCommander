import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { buildXlsxHtml, defaultLoadXlsxRenderer } from "./xlsxRenderer";

const mocks = vi.hoisted(() => ({
  readExcelFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: vi.fn(),
}));

vi.mock("read-excel-file/browser", () => ({
  default: mocks.readExcelFile,
}));

describe("xlsxRenderer", () => {
  beforeEach(() => {
    mocks.readExcelFile.mockReset();
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }) as unknown as typeof fetch;
  });

  it("renders workbook rows using readFileBinary", async () => {
    mocks.readExcelFile.mockResolvedValue([
      {
        sheet: "Budget <Q1>",
        data: [
          ["Name", "Value"],
          ["<script>alert(1)</script>", 42],
        ],
      },
    ]);

    const readFileBinary = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const renderer = await defaultLoadXlsxRenderer({ readFileBinary });
    const html = await renderer.renderXlsx("/tmp/book.xlsx");

    expect(readFileBinary).toHaveBeenCalledWith("/tmp/book.xlsx");
    expect(html).toContain("Budget &lt;Q1&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("falls back to fetch when convertFileSrcImpl is provided and readFileBinary fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("IPC failed"));
    mocks.readExcelFile.mockResolvedValue([
      {
        sheet: "Sheet1",
        data: [["A", "B"]],
      },
    ]);

    const html = await buildXlsxHtml("/tmp/book.xlsx", {
      convertFileSrcImpl: (p) => `asset://${p}`,
      fetchImpl: globalThis.fetch,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("asset:///tmp/book.xlsx");
    expect(html).toContain("Sheet1");
  });
});
