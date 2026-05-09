import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  mockGetDirSize,
  mockListDirectory,
  registerFilePanelTestLifecycle,
  setLeftPanelPath,
} from "./FilePanel.test-harness";
import { FilePanel } from "./FilePanel";
import { usePanelStore } from "../../store/panelStore";
import type { FileEntry } from "../../types/file";

const entries: FileEntry[] = [
  { name: "..", path: "/home", kind: "directory" },
  { name: "Documents", path: "/home/user/Documents", kind: "directory", size: null },
  { name: "notes.txt", path: "/home/user/notes.txt", kind: "file", size: 1024 },
  { name: "photo.png", path: "/home/user/photo.png", kind: "file", size: 2048 },
];

describe("FilePanel quick filter", () => {
  registerFilePanelTestLifecycle();

  it("filters the current folder by filename", async () => {
    mockListDirectory.mockResolvedValue(entries);
    mockGetDirSize.mockResolvedValue(0);
    setLeftPanelPath("/home/user");

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId("file-row-notes.txt")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("현재 폴더 필터"), {
      target: { value: "note" },
    });

    expect(screen.getByTestId("file-row-notes.txt")).toBeInTheDocument();
    expect(screen.queryByTestId("file-row-Documents")).not.toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("clears hidden selections while a quick filter is active", async () => {
    mockListDirectory.mockResolvedValue(entries);
    mockGetDirSize.mockResolvedValue(0);
    setLeftPanelPath("/home/user");

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId("file-row-Documents")).toBeInTheDocument();
    });

    usePanelStore.getState().setSelection("left", [
      "/home/user/Documents",
      "/home/user/photo.png",
    ]);

    fireEvent.change(screen.getByLabelText("현재 폴더 필터"), {
      target: { value: "doc" },
    });

    await waitFor(() => {
      expect(Array.from(usePanelStore.getState().leftPanel.selectedItems)).toEqual([
        "/home/user/Documents",
      ]);
    });
  });

  it("clears the quick filter with the clear button", async () => {
    mockListDirectory.mockResolvedValue(entries);
    mockGetDirSize.mockResolvedValue(0);
    setLeftPanelPath("/home/user");

    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(screen.getByTestId("file-row-photo.png")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("현재 폴더 필터"), {
      target: { value: "photo" },
    });
    fireEvent.click(screen.getByTitle("필터 지우기"));

    expect(screen.getByTestId("file-row-Documents")).toBeInTheDocument();
    expect(screen.getByTestId("file-row-notes.txt")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
