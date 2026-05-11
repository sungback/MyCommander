import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveList } from "./DriveList";
import type { DriveInfo } from "../../hooks/useFileSystem";

const mockSetPath = vi.fn();
const mockGetDrives = vi.fn();

const mockPanelState = {
  leftPanel: {
    currentPath: "C:\\",
  },
  rightPanel: {
    currentPath: "/Volumes/Backup",
  },
  setPath: mockSetPath,
};

vi.mock("../../store/panelStore", () => ({
  usePanelStore: (selector: (state: typeof mockPanelState) => unknown) =>
    selector(mockPanelState),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    getDrives: mockGetDrives,
  }),
}));

const drives: DriveInfo[] = [
  {
    mount_point: "C:\\",
    name: "Local Disk (C:)",
    type: "system",
    icon: "drive",
    isEjectable: false,
    availableSpace: 100_000_000_000,
  },
];

const macDrives: DriveInfo[] = [
  {
    mount_point: "/",
    name: "Macintosh HD",
    type: "system",
    icon: "drive",
    isEjectable: false,
    availableSpace: 257_210_000_000,
  },
  {
    mount_point: "/Volumes/Backup",
    name: "Backup",
    type: "removable",
    icon: "drive",
    isEjectable: true,
    availableSpace: null,
  },
];

describe("DriveList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelState.leftPanel.currentPath = "C:\\";
    mockPanelState.rightPanel.currentPath = "/Volumes/Backup";
    mockGetDrives.mockResolvedValue(drives);
  });

  it("드라이브의 남은 용량을 표시한다", async () => {
    render(<DriveList panelId="left" />);

    expect(await screen.findByText("100.00 GB free")).toBeInTheDocument();
    expect(
      screen.getByTitle("Local Disk (C:) (system) - 100.00 GB free")
    ).toHaveAttribute("title", "Local Disk (C:) (system) - 100.00 GB free");
  });

  it("드라이브 클릭 시 해당 패널 경로를 변경한다", async () => {
    render(<DriveList panelId="left" />);

    fireEvent.click(await screen.findByRole("button", { name: /\[C:\\\]/ }));

    expect(mockSetPath).toHaveBeenCalledWith("left", "C:\\");
  });

  it("macOS 루트 드라이브를 Macintosh HD로 표시하고 '/'로 이동한다", async () => {
    mockPanelState.leftPanel.currentPath = "/";
    mockGetDrives.mockResolvedValue(macDrives);

    render(<DriveList panelId="left" />);

    const rootButton = await screen.findByRole("button", { name: /Macintosh HD/ });
    expect(rootButton).toBeInTheDocument();
    expect(screen.queryByText("[/]")).not.toBeInTheDocument();

    fireEvent.click(rootButton);

    expect(mockSetPath).toHaveBeenCalledWith("left", "/");
  });

  it("macOS 볼륨 경로에서는 '/' 루트 대신 해당 볼륨을 활성화한다", async () => {
    mockGetDrives.mockResolvedValue(macDrives);

    render(<DriveList panelId="right" />);

    const rootButton = await screen.findByRole("button", { name: /Macintosh HD/ });
    const volumeButton = screen.getByRole("button", { name: /Backup/ });

    expect(rootButton).not.toHaveClass("text-text-primary");
    expect(volumeButton).toHaveClass("text-text-primary");
  });
});
