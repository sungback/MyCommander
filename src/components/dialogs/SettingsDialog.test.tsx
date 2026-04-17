import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsDialog } from "./SettingsDialog";
import { useDialogStore } from "../../store/dialogStore";
import { useSettingsStore } from "../../store/settingsStore";

const mockSetSize = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setSize: mockSetSize,
  }),
  LogicalSize: class LogicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
}));

describe("SettingsDialog", () => {
  beforeEach(() => {
    mockSetSize.mockReset();
    useDialogStore.setState(useDialogStore.getInitialState());
    useSettingsStore.setState(useSettingsStore.getInitialState());
    useDialogStore.getState().setOpenDialog("settings");
  });

  it("saves the typed font family", () => {
    render(<SettingsDialog />);

    fireEvent.change(screen.getByLabelText("글꼴"), {
      target: { value: 'D2Coding, "Noto Sans KR"' },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(useSettingsStore.getState().fontFamily).toBe(
      'D2Coding, "Noto Sans KR"'
    );
  });

  it("resets the font field to the default", () => {
    render(<SettingsDialog />);

    fireEvent.change(screen.getByLabelText("글꼴"), {
      target: { value: '"Noto Sans KR", sans-serif' },
    });
    fireEvent.click(screen.getByRole("button", { name: "기본값으로 되돌리기" }));

    expect(screen.getByLabelText("글꼴")).toHaveValue("");
  });
});
