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

    const iconPlate = container.querySelector(".theme-file-icon-plate");
    expect(iconPlate).not.toBeNull();
    expect(iconPlate).toHaveClass("theme-file-document-plate");

    const icon = iconPlate?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("theme-file-document-icon");
    expect(icon).not.toHaveClass("theme-selection-text");
  });
});
