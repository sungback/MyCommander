import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import JSZip from "jszip";
import { buildXlsxHtml, defaultLoadXlsxRenderer, repackWithoutCompression } from "./xlsxRenderer";

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

const createWorkbookBytes = async (sheetXml = "<worksheet/>") => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("xl/worksheets/sheet1.xml", sheetXml);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
};

// zip 로컬 파일 헤더(PK\x03\x04)마다 압축 방식(오프셋 8, 0 = 저장)을 모은다.
const readLocalHeaderMethods = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  const methods: number[] = [];
  for (let offset = 0; offset + 30 <= buffer.byteLength; offset += 1) {
    if (view.getUint32(offset, true) === 0x04034b50) {
      methods.push(view.getUint16(offset + 8, true));
    }
  }
  return methods;
};

describe("xlsxRenderer", () => {
  beforeEach(async () => {
    mocks.readExcelFile.mockReset();
    const workbookBytes = await createWorkbookBytes();
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(workbookBytes),
    }) as unknown as typeof fetch;
  });

  it("repacks workbooks without compression so large sheets skip fflate workers", async () => {
    const largeSheetXml = `<worksheet>${"<row/>".repeat(100_000)}</worksheet>`;
    const repacked = await repackWithoutCompression(await createWorkbookBytes(largeSheetXml));

    expect(new Set(readLocalHeaderMethods(repacked))).toEqual(new Set([0]));
    const zip = await JSZip.loadAsync(repacked);
    expect(await zip.file("xl/worksheets/sheet1.xml")?.async("string")).toBe(largeSheetXml);
  });

  it("passes the repacked workbook to read-excel-file", async () => {
    mocks.readExcelFile.mockResolvedValue([{ sheet: "Sheet1", data: [["A"]] }]);

    await buildXlsxHtml("/tmp/book.xlsx", {
      readFileBinary: vi.fn().mockResolvedValue(await createWorkbookBytes()),
    });

    const input = mocks.readExcelFile.mock.calls[0][0] as ArrayBuffer;
    expect(input).toBeInstanceOf(ArrayBuffer);
    expect(new Set(readLocalHeaderMethods(input))).toEqual(new Set([0]));
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

    const readFileBinary = vi.fn().mockResolvedValue(await createWorkbookBytes());
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
