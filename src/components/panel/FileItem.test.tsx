import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileItem } from "./FileItem";
import type { FileEntry } from "../../types/file";

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
    expect(label).toHaveTextContent("MD");
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
    expect(label).toHaveTextContent("SEC");
  });
});
