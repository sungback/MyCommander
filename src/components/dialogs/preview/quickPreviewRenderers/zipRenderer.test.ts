import { describe, expect, it, vi } from "vitest";
import type { ZipArchivePreview } from "../../../../types/zipPreview";
import { buildZipPreviewHtml, defaultLoadZipRenderer } from "./zipRenderer";

describe("zipRenderer", () => {
  const sampleArchive: ZipArchivePreview = {
    fileName: "archive.zip",
    fileSize: 1024,
    totalEntries: 3,
    totalFiles: 2,
    totalDirs: 1,
    totalUncompressedSize: 2000,
    totalCompressedSize: 1000,
    entries: [
      {
        path: "folder/",
        name: "folder",
        isDir: true,
        size: 0,
        compressedSize: 0,
        modified: "2026-10-04 12:00:00",
      },
      {
        path: "folder/test.txt",
        name: "test.txt",
        isDir: false,
        size: 1500,
        compressedSize: 750,
        modified: "2026-10-04 12:01:00",
      },
      {
        path: "image.png",
        name: "image.png",
        isDir: false,
        size: 500,
        compressedSize: 250,
        modified: "2026-10-04 12:02:00",
      },
    ],
  };

  it("builds styled HTML preview with summary stats and entry rows", () => {
    document.documentElement.dataset.theme = "dark";
    const html = buildZipPreviewHtml(sampleArchive);

    expect(html).toContain("ZIP");
    expect(html).toContain("2 파일");
    expect(html).toContain("1 폴더");
    expect(html).toContain("절약 50%");
    expect(html).toContain("folder/test.txt");
    expect(html).toContain("image.png");
  });

  it("loads zip renderer and calls previewZipArchive", async () => {
    const previewZipArchive = vi.fn().mockResolvedValue(sampleArchive);
    const renderer = await defaultLoadZipRenderer({ previewZipArchive });

    const result = await renderer.renderZip("/path/to/archive.zip");
    expect(previewZipArchive).toHaveBeenCalledWith("/path/to/archive.zip");
    expect(result.archive).toEqual(sampleArchive);
    expect(result.renderedHtml).toContain("2 파일");
  });
});
