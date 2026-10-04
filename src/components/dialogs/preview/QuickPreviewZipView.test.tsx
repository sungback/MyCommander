import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZipArchivePreview } from "../../../types/zipPreview";
import { QuickPreviewZipView } from "./QuickPreviewZipView";

describe("QuickPreviewZipView", () => {
  const sampleArchive: ZipArchivePreview = {
    fileName: "archive.zip",
    fileSize: 2048,
    totalEntries: 3,
    totalFiles: 2,
    totalDirs: 1,
    totalUncompressedSize: 2000,
    totalCompressedSize: 1000,
    entries: [
      {
        path: "docs/",
        name: "docs",
        isDir: true,
        size: 0,
        compressedSize: 0,
        modified: "2026-10-04 12:00:00",
      },
      {
        path: "docs/readme.txt",
        name: "readme.txt",
        isDir: false,
        size: 1500,
        compressedSize: 750,
        modified: "2026-10-04 12:01:00",
      },
      {
        path: "photo.png",
        name: "photo.png",
        isDir: false,
        size: 500,
        compressedSize: 250,
        modified: "2026-10-04 12:02:00",
      },
    ],
  };

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders archive summary and tree entries by default", () => {
    render(<QuickPreviewZipView archive={sampleArchive} />);

    expect(screen.getByText("ZIP 아카이브")).toBeInTheDocument();
    expect(screen.getByText("2 파일, 1 폴더")).toBeInTheDocument();
    expect(screen.getByText("50% 절약")).toBeInTheDocument();

    // Root-level items
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    // Nested child visible since depth < 2 expanded by default
    expect(screen.getByText("readme.txt")).toBeInTheDocument();
  });

  it("toggles between Tree and Table view modes", () => {
    render(<QuickPreviewZipView archive={sampleArchive} />);

    const tableBtn = screen.getByTitle("목록 형식으로 보기");
    fireEvent.click(tableBtn);

    // Table view header visible
    expect(screen.getByText("경로 / 파일명")).toBeInTheDocument();
    expect(screen.getByText("docs/readme.txt")).toBeInTheDocument();

    const treeBtn = screen.getByTitle("트리 형식으로 보기");
    fireEvent.click(treeBtn);

    // Back to tree view
    expect(screen.getByTitle("모두 접기")).toBeInTheDocument();
  });

  it("filters items by search query and can clear", () => {
    render(<QuickPreviewZipView archive={sampleArchive} />);

    const searchInput = screen.getByPlaceholderText("압축 파일 내 파일/폴더 검색...");
    fireEvent.change(searchInput, { target: { value: "photo" } });

    expect(screen.getByText("photo.png")).toBeInTheDocument();

    const clearBtn = screen.getByTitle("검색어 지우기");
    fireEvent.click(clearBtn);
    expect(searchInput).toHaveValue("");
  });

  it("supports expand all and collapse all in tree mode", () => {
    render(<QuickPreviewZipView archive={sampleArchive} />);

    const collapseAllBtn = screen.getByTitle("모두 접기");
    fireEvent.click(collapseAllBtn);

    // After collapsing all, nested child should not be visible
    expect(screen.queryByText("readme.txt")).not.toBeInTheDocument();

    const expandAllBtn = screen.getByTitle("모두 펼치기");
    fireEvent.click(expandAllBtn);

    // Expanded again: readme.txt should be back
    expect(screen.getByText("readme.txt")).toBeInTheDocument();
  });

  it("copies entry list to clipboard", async () => {
    render(<QuickPreviewZipView archive={sampleArchive} />);

    const copyBtn = screen.getByTitle("목록 텍스트 복사");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(await screen.findByText("복사됨")).toBeInTheDocument();
  });

  it("handles empty archive gracefully", () => {
    const emptyArchive: ZipArchivePreview = {
      fileName: "empty.zip",
      fileSize: 22,
      totalEntries: 0,
      totalFiles: 0,
      totalDirs: 0,
      totalUncompressedSize: 0,
      totalCompressedSize: 0,
      entries: [],
    };

    render(<QuickPreviewZipView archive={emptyArchive} />);

    expect(screen.getByText("압축 파일 내에 파일이나 폴더가 없습니다.")).toBeInTheDocument();
  });
});
