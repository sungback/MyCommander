import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColumnHeader } from "./ColumnHeader";
import { useSettingsStore, DEFAULT_COLUMN_WIDTHS } from "../../store/settingsStore";

describe("ColumnHeader", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState());
  });

  it("renders columns and calls onSort when clicked", () => {
    const onSort = vi.fn();
    render(<ColumnHeader sortField="name" sortDirection="asc" onSort={onSort} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Size"));
    expect(onSort).toHaveBeenCalledWith("size");
  });

  it("resizes size column on drag", () => {
    const onSort = vi.fn();
    render(<ColumnHeader sortField="name" sortDirection="asc" onSort={onSort} />);

    const resizeHandle = screen.getByLabelText("Resize Size Column");
    expect(resizeHandle).toBeInTheDocument();

    // 마우스 다운 -> 이동 -> 업
    fireEvent.mouseDown(resizeHandle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 }); // +50px
    fireEvent.mouseUp(window);

    expect(useSettingsStore.getState().columnWidths.size).toBe(
      DEFAULT_COLUMN_WIDTHS.size + 50
    );
    // 리사이즈 핸들 조작 시 onSort가 호출되지 않아야 함
    expect(onSort).not.toHaveBeenCalled();
  });

  it("resizes date column on drag", () => {
    const onSort = vi.fn();
    render(<ColumnHeader sortField="name" sortDirection="asc" onSort={onSort} />);

    const resizeHandle = screen.getByLabelText("Resize Date Column");
    fireEvent.mouseDown(resizeHandle, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 230 }); // +30px
    fireEvent.mouseUp(window);

    expect(useSettingsStore.getState().columnWidths.date).toBe(
      DEFAULT_COLUMN_WIDTHS.date + 30
    );
  });

  it("resets column width to default on double click", () => {
    useSettingsStore.getState().setColumnWidth("size", 200);
    expect(useSettingsStore.getState().columnWidths.size).toBe(200);

    render(<ColumnHeader sortField="name" sortDirection="asc" onSort={vi.fn()} />);

    const resizeHandle = screen.getByLabelText("Resize Size Column");
    fireEvent.doubleClick(resizeHandle);

    expect(useSettingsStore.getState().columnWidths.size).toBe(DEFAULT_COLUMN_WIDTHS.size);
  });
});
