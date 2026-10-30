import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveList } from "./DriveList";
import type { DriveInfo } from "../../hooks/useFileSystem";
import { notifyDrivesChanged } from "./driveEvents";

const mockSetPath = vi.fn();
const mockGetDrives = vi.fn();
const mockEjectDrive = vi.fn();
const mockGetHomeDir = vi.fn();

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
  usePanelStore: Object.assign(
    (selector: (state: typeof mockPanelState) => unknown) =>
      selector(mockPanelState),
    { getState: () => mockPanelState }
  ),
}));

// 실제 useFileSystem()처럼 항상 같은 객체를 돌려준다.
const mockFileSystem = {
  getDrives: mockGetDrives,
  ejectDrive: mockEjectDrive,
  getHomeDir: mockGetHomeDir,
};

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => mockFileSystem,
  getErrorMessage: (error: unknown, fallback: string) =>
    typeof error === "string" ? error : fallback,
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
    mockEjectDrive.mockResolvedValue(undefined);
    mockGetHomeDir.mockResolvedValue("/Users/me");
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
    const volumeButton = screen.getByRole("button", { name: "Backup" });

    expect(rootButton).not.toHaveClass("text-text-primary");
    expect(volumeButton).toHaveClass("text-text-primary");
  });

  it("추출 가능한 드라이브에만 추출 버튼을 표시한다", async () => {
    mockGetDrives.mockResolvedValue(macDrives);

    render(<DriveList panelId="left" />);

    expect(await screen.findByRole("button", { name: "Backup 추출" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Macintosh HD 추출" })
    ).not.toBeInTheDocument();
  });

  it("추출하면 그 드라이브 안을 보던 패널만 홈 폴더로 옮기고 목록을 다시 읽는다", async () => {
    mockPanelState.leftPanel.currentPath = "/";
    mockGetDrives.mockResolvedValue(macDrives);

    render(<DriveList panelId="left" />);
    fireEvent.click(await screen.findByRole("button", { name: "Backup 추출" }));

    await waitFor(() => expect(mockSetPath).toHaveBeenCalledWith("right", "/Users/me"));
    expect(mockEjectDrive).toHaveBeenCalledWith("/Volumes/Backup");
    expect(mockSetPath).not.toHaveBeenCalledWith("left", expect.anything());
    await waitFor(() => expect(mockGetDrives).toHaveBeenCalledTimes(2));
  });

  it("추출에 실패하면 알리고 패널을 옮기지 않는다", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetDrives.mockResolvedValue(macDrives);
    mockEjectDrive.mockRejectedValue("Volume is busy");

    render(<DriveList panelId="right" />);
    fireEvent.click(await screen.findByRole("button", { name: "Backup 추출" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Volume is busy"));
    expect(mockSetPath).not.toHaveBeenCalled();
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("마운트 알림과 창 포커스 때 드라이브 목록을 다시 읽는다", async () => {
    render(<DriveList panelId="left" />);
    await screen.findByText("100.00 GB free");
    expect(mockGetDrives).toHaveBeenCalledTimes(1);

    notifyDrivesChanged();
    await waitFor(() => expect(mockGetDrives).toHaveBeenCalledTimes(2));

    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(mockGetDrives).toHaveBeenCalledTimes(3));
  });
});
