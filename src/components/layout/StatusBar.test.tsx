import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

const mockSetOpenDialog = vi.fn();
const mockGetAvailableSpace = vi.fn();

const mockPanelState = {
  activePanel: "left" as const,
  leftPanel: {
    currentPath: "/home/user",
    selectedItems: new Set<string>(),
    files: [],
  },
  rightPanel: {
    currentPath: "/home/other",
    selectedItems: new Set<string>(),
    files: [],
  },
  clipboard: null,
  clearClipboard: vi.fn(),
};

vi.mock("../../store/panelStore", () => ({
  usePanelStore: Object.assign(
    (selector?: (state: typeof mockPanelState) => unknown) =>
      selector ? selector(mockPanelState) : mockPanelState,
    {
      getState: () => mockPanelState,
    }
  ),
}));

vi.mock("../../store/uiStore", () => ({
  useUiStore: (selector: (state: { statusMessage: string | null }) => unknown) =>
    selector({ statusMessage: null }),
}));

vi.mock("../../store/dialogStore", () => ({
  useDialogStore: Object.assign(
    (selector?: (state: { setOpenDialog: typeof mockSetOpenDialog }) => unknown) =>
      selector ? selector({ setOpenDialog: mockSetOpenDialog }) : null,
    {
      getState: () => ({ setOpenDialog: mockSetOpenDialog }),
    }
  ),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    getAvailableSpace: mockGetAvailableSpace,
  }),
}));

vi.mock("../../hooks/useAppCommands", () => ({
  isMacPlatform: () => false,
  useAppCommands: () => ({
    openPreview: vi.fn(),
    openEditor: vi.fn(),
    openCopy: vi.fn(),
    openMove: vi.fn(),
    openMkdir: vi.fn(),
    openDelete: vi.fn(),
    openSearch: vi.fn(),
    closeApp: vi.fn(),
    runCommandInCurrentPath: vi.fn(),
  }),
}));

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableSpace.mockResolvedValue(1024);
  });

  it("설정 버튼 클릭 시 settings 다이얼로그를 연다", () => {
    render(<StatusBar />);

    fireEvent.click(screen.getByRole("button", { name: "설정" }));

    expect(mockSetOpenDialog).toHaveBeenCalledWith("settings");
  });

  it("작업 버튼 클릭 시 jobcenter 다이얼로그를 연다", () => {
    render(<StatusBar />);

    fireEvent.click(screen.getByRole("button", { name: "작업 센터" }));

    expect(mockSetOpenDialog).toHaveBeenCalledWith("jobcenter");
  });
});
