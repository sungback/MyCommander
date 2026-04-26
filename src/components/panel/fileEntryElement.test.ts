import { describe, expect, it } from "vitest";
import {
  findFileEntryElement,
  getFileEntryDataAttributes,
  getFileEntryIndex,
  readFileEntryFromElement,
} from "./fileEntryElement";
import { FileEntry } from "../../types/file";

const applyDataAttributes = (
  element: HTMLElement,
  attributes: ReturnType<typeof getFileEntryDataAttributes>
) => {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
};

describe("fileEntryElement", () => {
  it("round-trips a file entry through row data attributes", () => {
    const entry: FileEntry = {
      name: "work",
      path: "/Users/back/Documents/work",
      kind: "directory",
      isHidden: true,
    };
    const row = document.createElement("div");

    applyDataAttributes(row, getFileEntryDataAttributes(entry, 7));

    expect(readFileEntryFromElement(row)).toEqual(entry);
    expect(getFileEntryIndex(row)).toBe(7);
  });

  it("finds file entry metadata from a nested event target", () => {
    const row = document.createElement("div");
    const button = document.createElement("button");
    applyDataAttributes(
      row,
      getFileEntryDataAttributes(
        { name: "notes.txt", path: "/Users/back/notes.txt", kind: "file" },
        3
      )
    );
    row.appendChild(button);

    expect(findFileEntryElement(button)).toBe(row);
    expect(readFileEntryFromElement(findFileEntryElement(button))).toEqual({
      name: "notes.txt",
      path: "/Users/back/notes.txt",
      kind: "file",
      isHidden: false,
    });
  });

  it("does not reconstruct entries with missing or invalid metadata", () => {
    const missingKind = document.createElement("div");
    missingKind.dataset.entryPath = "/Users/back/missing-kind";

    const invalidKind = document.createElement("div");
    invalidKind.dataset.entryPath = "/Users/back/archive.zip";
    invalidKind.dataset.entryName = "archive.zip";
    invalidKind.dataset.entryKind = "archive";

    expect(readFileEntryFromElement(null)).toBeNull();
    expect(readFileEntryFromElement(missingKind)).toBeNull();
    expect(readFileEntryFromElement(invalidKind)).toBeNull();
  });

  it("ignores missing or invalid row indexes", () => {
    const missingIndex = document.createElement("div");
    const invalidIndex = document.createElement("div");
    const validZeroIndex = document.createElement("div");

    invalidIndex.dataset.entryIndex = "not-a-number";
    validZeroIndex.dataset.entryIndex = "0";

    expect(getFileEntryIndex(null)).toBeNull();
    expect(getFileEntryIndex(missingIndex)).toBeNull();
    expect(getFileEntryIndex(invalidIndex)).toBeNull();
    expect(getFileEntryIndex(validZeroIndex)).toBe(0);
  });
});
