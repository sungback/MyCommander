import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileItem } from "./FileItem";
import type { FileEntry } from "../../types/file";
import {
  __resetSessionVerifiedSizesForTests,
  recordSizeScannedAt,
} from "../../store/panelStoreFileHelpers";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

const createFile = (name: string): FileEntry => ({
  name,
  path: `/tmp/${name}`,
  kind: "file",
  size: 1024,
});

describe("FileItem", () => {
  it("renders decomposed Hangul filenames as visible compatibility jamo", () => {
    const nfdName = "머신.txt".normalize("NFD");

    render(
      <FileItem
        entry={createFile(nfdName)}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(screen.getByText("ㅁㅓㅅㅣㄴ.txt")).toBeInTheDocument();
  });

  it("preserves file icon color and plate on selected rows", () => {
    const { container } = render(
      <FileItem
        entry={createFile("notes.md")}
        isSelected
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    const iconPlate = container.querySelector(".theme-tc-icon-slot");
    expect(iconPlate).not.toBeNull();
    expect(iconPlate).toHaveClass("theme-tc-slot-text-file");
    expect(iconPlate).toHaveClass("theme-tc-type-document");

    const icon = iconPlate?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("theme-tc-file-glyph-text");
    expect(icon).not.toHaveClass("theme-selection-text");

    const label = iconPlate?.querySelector(".theme-tc-extension-label");
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent("md");
    expect(label).toHaveClass("theme-tc-ext-md");
  });

  it("renders hidden file overlays independently from row selection text", () => {
    const { container } = render(
      <FileItem
        entry={{ ...createFile(".secret"), isHidden: true }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    const overlay = container.querySelector(".theme-tc-overlay-hidden");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass("theme-tc-overlay");

    const label = container.querySelector(".theme-tc-extension-label");
    expect(label).not.toBeNull();
    expect(label).toHaveTextContent("sec");
  });

  it("marks estimated and partial directory sizes", () => {
    render(
      <>
        <FileItem
          entry={{
            name: "estimated",
            path: "/tmp/estimated",
            kind: "directory",
            size: 1024,
            sizeStatus: "estimated",
          }}
          viewMode="detailed"
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
        />
        <FileItem
          entry={{
            name: "partial",
            path: "/tmp/partial",
            kind: "directory",
            size: 2048,
            sizeStatus: "partial",
          }}
          viewMode="detailed"
          onClick={vi.fn()}
          onDoubleClick={vi.fn()}
        />
      </>
    );

    expect(screen.getByText("~1.0 KB")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB+")).toBeInTheDocument();
    expect(screen.getByLabelText(/빠른 추정 크기입니다/)).toBeInTheDocument();
    expect(screen.getByLabelText(/부분 계산 결과입니다/)).toBeInTheDocument();
  });

  it("hides zero-size quick estimates instead of showing ~0 B", () => {
    render(
      <FileItem
        entry={{
          name: "Users",
          path: "/Users",
          kind: "directory",
          size: 0,
          sizeStatus: "estimated",
        }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(screen.queryByText("~0 B")).not.toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByLabelText(/빠른 추정으로는 크기를 알 수 없습니다/)).toBeInTheDocument();
  });

  it("marks limited directory sizes as lower bounds", () => {
    render(
      <FileItem
        entry={{
          name: "limited",
          path: "/tmp/limited",
          kind: "directory",
          size: 4096,
          sizeStatus: "limited",
        }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(screen.getByText("≥4.0 KB")).toBeInTheDocument();
    expect(screen.getByLabelText(/접근 권한이 없는 항목을 뺀 크기입니다/)).toBeInTheDocument();
  });

  it("shows when a directory size was calculated", () => {
    __resetSessionVerifiedSizesForTests();
    recordSizeScannedAt("/Users/sam/AppData", Date.now() - 3 * 24 * 60 * 60_000);

    render(
      <FileItem
        entry={{
          name: "AppData",
          path: "/Users/sam/AppData",
          kind: "directory",
          size: 4096,
          sizeStatus: "exact",
        }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText(/정확히 계산된 크기입니다\. 3일 전에 계산한 값입니다\./)
    ).toBeInTheDocument();
    __resetSessionVerifiedSizesForTests();
  });

  it("explains why cloud storage folder sizes stay estimated", () => {
    render(
      <FileItem
        entry={{
          name: "내 드라이브",
          path: "/Users/sam/내 드라이브",
          kind: "directory",
          size: 2048,
          sizeStatus: "estimated",
        }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(screen.getByText("~2.0 KB")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/클라우드 동기화 폴더라 자동으로 정확히 계산하지 않습니다/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/빠른 추정 크기입니다/)).not.toBeInTheDocument();
  });

  it("labels directory size calculation errors", () => {
    render(
      <FileItem
        entry={{
          name: "broken",
          path: "/tmp/broken",
          kind: "directory",
          sizeStatus: "error",
        }}
        viewMode="detailed"
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/크기를 계산하지 못했습니다/)).toBeInTheDocument();
  });
});
