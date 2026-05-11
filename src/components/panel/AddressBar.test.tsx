import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressBar } from "./AddressBar";

const {
  mockSetPath,
  mockGoBack,
  mockGoForward,
  mockRefreshPanel,
  mockSetActivePanel,
  mockGetHomeDir,
  mockSyncOtherPanelToCurrentPath,
  mockCopyCurrentPath,
  mockGetBreadcrumbParts,
  mockIsMacPlatform,
} = vi.hoisted(() => ({
  mockSetPath: vi.fn(),
  mockGoBack: vi.fn(),
  mockGoForward: vi.fn(),
  mockRefreshPanel: vi.fn(),
  mockSetActivePanel: vi.fn(),
  mockGetHomeDir: vi.fn(),
  mockSyncOtherPanelToCurrentPath: vi.fn(),
  mockCopyCurrentPath: vi.fn(),
  mockGetBreadcrumbParts: vi.fn(),
  mockIsMacPlatform: vi.fn(),
}));

const mockPanelState = {
  leftPanel: {
    currentPath: "/home/user/docs",
    resolvedPath: undefined as string | undefined,
    historyIndex: 1,
    history: ["/home/user", "/home/user/docs"],
  },
  rightPanel: {
    currentPath: "/home/user/pictures",
    resolvedPath: undefined as string | undefined,
    historyIndex: 0,
    history: ["/home/user/pictures"],
  },
  setPath: mockSetPath,
  goBack: mockGoBack,
  goForward: mockGoForward,
  refreshPanel: mockRefreshPanel,
  setActivePanel: mockSetActivePanel,
  activePanel: "left" as "left" | "right",
};

vi.mock("../../store/panelStore", () => ({
  usePanelStore: vi.fn().mockImplementation((selector: (s: typeof mockPanelState) => unknown) =>
    selector(mockPanelState)
  ),
}));

vi.mock("../../hooks/useGitStatus", () => ({
  useGitStatus: vi.fn().mockReturnValue({ gitStatus: null }),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    getHomeDir: mockGetHomeDir,
  }),
}));

vi.mock("../../hooks/useAppCommands", () => ({
  isMacPlatform: mockIsMacPlatform,
  useAppCommands: () => ({
    syncOtherPanelToCurrentPath: mockSyncOtherPanelToCurrentPath,
    copyCurrentPath: mockCopyCurrentPath,
  }),
}));

vi.mock("../../utils/path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/path")>();
  return {
    ...actual,
    getBreadcrumbParts: mockGetBreadcrumbParts,
  };
});

describe("AddressBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHomeDir.mockResolvedValue("/home/user");
    mockPanelState.leftPanel.historyIndex = 1;
    mockPanelState.leftPanel.history = ["/home/user", "/home/user/docs"];
    mockPanelState.rightPanel.currentPath = "/home/user/pictures";
    mockPanelState.activePanel = "left";
    mockIsMacPlatform.mockReturnValue(false);
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
    mockGetBreadcrumbParts.mockReturnValue([
      { path: "/home", label: "home" },
      { path: "/home/user", label: "user" },
      { path: "/home/user/docs", label: "docs" },
    ]);
  });

  it("historyIndex가 0이면 뒤로 버튼이 비활성화된다", () => {
    mockPanelState.leftPanel.historyIndex = 0;
    mockPanelState.leftPanel.history = ["/home/user"];

    render(<AddressBar panelId="left" />);

    const backButton = screen.getByTitle("뒤로 (Alt+←)");
    expect(backButton).toBeDisabled();
  });

  it("historyIndex가 마지막이면 앞으로 버튼이 비활성화된다", () => {
    mockPanelState.leftPanel.historyIndex = 1;
    mockPanelState.leftPanel.history = ["/home/user", "/home/user/docs"];

    render(<AddressBar panelId="left" />);

    const forwardButton = screen.getByTitle("앞으로 (Alt+→)");
    expect(forwardButton).toBeDisabled();
  });

  it("gitStatus가 있으면 브랜치와 변경 지표를 렌더링한다", async () => {
    const { useGitStatus } = await import("../../hooks/useGitStatus");
    vi.mocked(useGitStatus).mockReturnValueOnce({
      gitStatus: {
        branch: "main",
        modified: ["a.ts", "b.ts"],
        added: ["c.ts"],
        deleted: [],
        untracked: ["d.ts"],
      },
      isLoading: false,
    });

    render(<AddressBar panelId="left" />);

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("●2")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("?1")).toBeInTheDocument();
  });

  it("gitStatus가 null이면 브랜치 정보를 렌더링하지 않는다", () => {
    render(<AddressBar panelId="left" />);

    expect(screen.queryByText("main")).not.toBeInTheDocument();
  });

  it("두 패널 경로가 같으면 동기화 버튼이 비활성화된다", () => {
    mockPanelState.rightPanel.currentPath = "/home/user/docs";

    render(<AddressBar panelId="left" />);

    const syncButton = screen.getByTitle(/already on this folder/i);
    expect(syncButton).toBeDisabled();
  });

  it("브레드크럼 버튼 클릭 시 해당 경로로 setPath를 호출한다", async () => {
    const user = userEvent.setup();
    render(<AddressBar panelId="left" />);

    await user.click(screen.getByText("user"));

    expect(mockSetActivePanel).toHaveBeenCalledWith("left");
    expect(mockSetPath).toHaveBeenCalledWith("left", "/home/user");
  });

  it("macOS 루트 브레드크럼은 Macintosh HD로 표시한다", () => {
    mockPanelState.leftPanel.currentPath = "/";
    mockPanelState.leftPanel.historyIndex = 0;
    mockPanelState.leftPanel.history = ["/"];
    mockIsMacPlatform.mockReturnValue(true);
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    mockGetBreadcrumbParts.mockReturnValue([{ path: "/", label: "/" }]);

    render(<AddressBar panelId="left" />);

    expect(
      screen.getByRole("button", { name: "Macintosh HD" })
    ).toBeInTheDocument();
  });
});
