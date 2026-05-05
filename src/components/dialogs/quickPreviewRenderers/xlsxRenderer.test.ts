import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLoadXlsxRenderer } from "./xlsxRenderer";

const mocks = vi.hoisted(() => ({
  readExcelFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
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

  it("renders workbook rows while escaping cell content", async () => {
    mocks.readExcelFile.mockResolvedValue([
      {
        sheet: "Budget <Q1>",
        data: [
          ["Name", "Value"],
          ["<script>alert(1)</script>", 42],
        ],
      },
    ]);

    const renderer = await defaultLoadXlsxRenderer();
    const html = await renderer.renderXlsx("/tmp/book.xlsx");

    expect(globalThis.fetch).toHaveBeenCalledWith("asset:///tmp/book.xlsx");
    expect(html).toContain("Budget &lt;Q1&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
