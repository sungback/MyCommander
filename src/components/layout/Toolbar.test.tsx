import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import packageJson from "../../../package.json";
import { Toolbar } from "./Toolbar";

vi.mock("../../hooks/useAppCommands", () => ({
  isMacPlatform: () => true,
  useAppCommands: () => ({
    viewFile: vi.fn(),
    editFile: vi.fn(),
    copySelected: vi.fn(),
    moveSelected: vi.fn(),
    createFolder: vi.fn(),
    deleteSelected: vi.fn(),
  }),
}));

vi.mock("../../store/dialogStore", () => ({
  useDialogStore: {
    getState: () => ({
      setOpenDialog: vi.fn(),
    }),
  },
}));

describe("Toolbar", () => {
  it("renders the application name with the current package version", () => {
    render(<Toolbar />);

    const expectedText = `MyCommander v${packageJson.version}`;
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
