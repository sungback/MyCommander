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

describe("DriveList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelState.leftPanel.currentPath = "C:\\";
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
});
