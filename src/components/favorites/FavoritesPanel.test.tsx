import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPanel } from "./FavoritesPanel";

const {
  mockFavoriteState,
  mockLocationState,
  mockPanelState,
  mockAddFavorite,
  mockRemoveFavorite,
  mockRenameFavorite,
  mockReorderFavorites,
  mockRemoveLocation,
  mockSetPath,
  mockToggleFavoritesPanel,
  mockShowTransientToast,
} = vi.hoisted(() => ({
  mockFavoriteState: {
    favorites: [] as Array<{ id: string; name: string; path: string; order: number }>,
  },
  mockLocationState: {
    locations: [] as Array<{
      path: string;
      name: string;
      lastVisited: number;
      visitCount: number;
    }>,
  },
  mockPanelState: {
    activePanel: "left" as const,
    dragInfo: null as
      | {
          paths: string[];
          directoryPaths: string[];
          sourcePanel: "left" | "right";
        }
      | null,
  },
  mockAddFavorite: vi.fn((path: string, name?: string) => {
    if (mockFavoriteState.favorites.some((favorite) => favorite.path === path)) {
      return;
    }

    const resolvedName =
      name ?? path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
    mockFavoriteState.favorites.push({
      id: `fav-${mockFavoriteState.favorites.length + 1}`,
      name: resolvedName,
      path,
      order: mockFavoriteState.favorites.length,
    });
  }),
  mockRemoveFavorite: vi.fn(),
  mockRenameFavorite: vi.fn(),
  mockReorderFavorites: vi.fn(),
  mockRemoveLocation: vi.fn(),
  mockSetPath: vi.fn(),
  mockToggleFavoritesPanel: vi.fn(),
  mockShowTransientToast: vi.fn(),
}));

vi.mock("../../store/favoriteStore", () => ({
  useFavoriteStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            favorites: mockFavoriteState.favorites,
            addFavorite: mockAddFavorite,
            removeFavorite: mockRemoveFavorite,
            renameFavorite: mockRenameFavorite,
            reorderFavorites: mockReorderFavorites,
          })
        : null,
    {
      getState: () => ({
        favorites: mockFavoriteState.favorites,
      }),
    }
  ),
}));

vi.mock("../../store/locationHistoryStore", () => ({
  getFrequentLocations: (
    locations: typeof mockLocationState.locations,
    limit = 5
  ) =>
    [...locations]
      .filter((entry) => entry.visitCount > 1)
      .sort(
        (left, right) =>
          right.visitCount - left.visitCount ||
          right.lastVisited - left.lastVisited
      )
      .slice(0, limit),
  getRecentLocations: (
    locations: typeof mockLocationState.locations,
    limit = 8
  ) => [...locations].sort((left, right) => right.lastVisited - left.lastVisited).slice(0, limit),
  useLocationHistoryStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            locations: mockLocationState.locations,
            removeLocation: mockRemoveLocation,
          })
        : null,
    {
      getState: () => ({
        locations: mockLocationState.locations,
        removeLocation: mockRemoveLocation,
      }),
    }
  ),
}));

vi.mock("../../store/panelStore", () => ({
  usePanelStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            activePanel: mockPanelState.activePanel,
            setPath: mockSetPath,
          })
        : null,
    {
      getState: () => ({
        activePanel: mockPanelState.activePanel,
      }),
    }
  ),
}));

vi.mock("../../store/dragStore", () => ({
  useDragStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            dragInfo: mockPanelState.dragInfo,
          })
        : null,
    {
      getState: () => ({
        dragInfo: mockPanelState.dragInfo,
      }),
    }
  ),
}));

vi.mock("../../store/uiStore", () => ({
  useUiStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector({
            showFavoritesPanel: true,
            toggleFavoritesPanel: mockToggleFavoritesPanel,
          })
        : null,
    {
      getState: () => ({
        showFavoritesPanel: true,
        toggleFavoritesPanel: mockToggleFavoritesPanel,
      }),
    }
  ),
}));

vi.mock("../../store/toastStore", () => ({
  showTransientToast: mockShowTransientToast,
}));

describe("FavoritesPanel", () => {
  const setPanelRect = (element: HTMLElement) => {
    Object.defineProperty(element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 180,
        bottom: 480,
        width: 180,
        height: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFavoriteState.favorites = [];
    mockLocationState.locations = [];
    mockPanelState.activePanel = "left";
    mockPanelState.dragInfo = null;
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("폴더를 드래그해서 즐겨찾기에 추가할 수 있다", async () => {
    const { getByTestId, getByText, rerender } = render(<FavoritesPanel />);
    const panel = getByTestId("favorites-panel");
    setPanelRect(panel);

    mockPanelState.dragInfo = {
      paths: ["/home/user/Documents"],
      directoryPaths: ["/home/user/Documents"],
      sourcePanel: "left",
    };
    rerender(<FavoritesPanel />);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    });

    expect(getByText("여기에 놓으면 즐겨찾기에 추가됩니다.")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 20, clientY: 20 }));
    });

    expect(mockAddFavorite).toHaveBeenCalledWith("/home/user/Documents");
    expect(mockFavoriteState.favorites).toEqual([
      expect.objectContaining({
        name: "Documents",
        path: "/home/user/Documents",
      }),
    ]);
    expect(mockShowTransientToast).toHaveBeenCalledWith("즐겨찾기에 폴더를 추가했습니다.", {
      durationMs: 1800,
      tone: "success",
    });
  });

  it("파일만 드래그하면 즐겨찾기에 추가하지 않는다", async () => {
    const { getByTestId, getByText, rerender } = render(<FavoritesPanel />);
    const panel = getByTestId("favorites-panel");
    setPanelRect(panel);

    mockPanelState.dragInfo = {
      paths: ["/home/user/notes.txt"],
      directoryPaths: [],
      sourcePanel: "left",
    };
    rerender(<FavoritesPanel />);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 24, clientY: 24 }));
    });

    expect(getByText("폴더만 즐겨찾기에 추가할 수 있습니다.")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 24, clientY: 24 }));
    });

    expect(mockAddFavorite).not.toHaveBeenCalled();
    expect(mockFavoriteState.favorites).toHaveLength(0);
    expect(mockShowTransientToast).toHaveBeenCalledWith("폴더만 즐겨찾기에 추가할 수 있습니다.", {
      durationMs: 1800,
      tone: "warning",
    });
  });

  it("이미 등록된 폴더는 중복 추가하지 않는다", async () => {
    mockFavoriteState.favorites = [
      {
        id: "fav-1",
        name: "Documents",
        path: "/home/user/Documents",
        order: 0,
      },
    ];
    const { getByTestId, rerender } = render(<FavoritesPanel />);
    const panel = getByTestId("favorites-panel");
    setPanelRect(panel);

    mockPanelState.dragInfo = {
      paths: ["/home/user/Documents"],
      directoryPaths: ["/home/user/Documents"],
      sourcePanel: "left",
    };
    rerender(<FavoritesPanel />);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 30, clientY: 30 }));
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 30, clientY: 30 }));
    });

    expect(mockFavoriteState.favorites).toHaveLength(1);
    expect(mockAddFavorite).not.toHaveBeenCalled();
    expect(mockShowTransientToast).toHaveBeenCalledWith("이미 즐겨찾기에 등록된 폴더입니다.", {
      durationMs: 1800,
      tone: "warning",
    });
  });

  it("토스트 호출이 다음 테스트로 새지 않는다", async () => {
    const { getByTestId, rerender } = render(<FavoritesPanel />);
    const panel = getByTestId("favorites-panel");
    setPanelRect(panel);

    mockPanelState.dragInfo = {
      paths: ["/home/user/Documents"],
      directoryPaths: ["/home/user/Documents"],
      sourcePanel: "left",
    };
    rerender(<FavoritesPanel />);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 20, clientY: 20 }));
    });

    expect(mockShowTransientToast).toHaveBeenCalledWith("즐겨찾기에 폴더를 추가했습니다.", {
      durationMs: 1800,
      tone: "success",
    });
  });

  it("최근 위치를 클릭하면 활성 패널에서 해당 경로를 연다", () => {
    mockLocationState.locations = [
      {
        path: "/home/user/Projects",
        name: "Projects",
        lastVisited: 20,
        visitCount: 1,
      },
    ];

    const { getByText } = render(<FavoritesPanel />);

    fireEvent.click(getByText("Projects"));

    expect(mockSetPath).toHaveBeenCalledWith("left", "/home/user/Projects");
  });

  it("macOS에서는 Macintosh HD 위치를 표시하고 루트로 이동한다", () => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });

    const { getByText } = render(<FavoritesPanel />);

    fireEvent.click(getByText("Macintosh HD"));

    expect(mockSetPath).toHaveBeenCalledWith("left", "/");
  });

  it("자주 쓰는 위치를 표시하고 기록 제거를 호출한다", () => {
    mockLocationState.locations = [
      {
        path: "/home/user/Projects",
        name: "Projects",
        lastVisited: 20,
        visitCount: 3,
      },
    ];

    const { getByText, getByTitle } = render(<FavoritesPanel />);

    expect(getByText("자주 쓰는 위치")).toBeInTheDocument();
    expect(getByText("3")).toBeInTheDocument();

    fireEvent.click(getByTitle("위치 기록 제거"));

    expect(mockRemoveLocation).toHaveBeenCalledWith("/home/user/Projects");
  });
});
