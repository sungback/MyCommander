import { FileEntry } from "../../types/file";
import { findFileEntryElement } from "./fileEntryElement";
import type { VisibleEntryRow } from "./fileListRows";

interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface VisibleEntryAtPointer {
  rowPath: string | null;
  targetEntry: FileEntry | null;
}

export const isPointerInsideElement = (
  pointer: PointerPosition,
  element: HTMLElement
) => {
  const rect = element.getBoundingClientRect();

  return (
    pointer.clientX >= rect.left &&
    pointer.clientX <= rect.right &&
    pointer.clientY >= rect.top &&
    pointer.clientY <= rect.bottom
  );
};

export const isPointerOutsideWindow = ({ clientX, clientY }: PointerPosition) =>
  clientX <= 0 ||
  clientY <= 0 ||
  clientX >= window.innerWidth ||
  clientY >= window.innerHeight;

export const findVisibleEntryAtPointer = (
  pointer: PointerPosition,
  container: HTMLElement,
  visibleRows: VisibleEntryRow[]
): VisibleEntryAtPointer => {
  const rowElement = findFileEntryElement(
    document.elementFromPoint(pointer.clientX, pointer.clientY)
  );
  const rowPath =
    rowElement && container.contains(rowElement)
      ? rowElement.dataset.entryPath ?? null
      : null;

  return {
    rowPath,
    targetEntry: rowPath
      ? visibleRows.find((row) => row.entry.path === rowPath)?.entry ?? null
      : null,
  };
};
