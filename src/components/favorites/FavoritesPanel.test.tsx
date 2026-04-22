import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPanel } from "./FavoritesPanel";

const {
  mockFavoriteState,
  mockUiState,
  mockPanelState,
  mockAddFavorite,
  mockRemoveFavorite,
  mockRenameFavorite,
  mockReorderFavorites,
  mockSetPath,
  mockToggleFavoritesPanel,
  mockSetStatusMessage,
} = vi.hoisted(() => ({
  mockFavoriteState: {
    favorites: [] as Array<{ id: string; name: string; path: string; order: number }>,
  },
  mockUiState: {
    statusMessage: null as string | null,
    showFavoritesPanel: true,
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
  mockSetPath: vi.fn(),
  mockToggleFavoritesPanel: vi.fn(),
  mockSetStatusMessage: vi.fn((message: string | null) => {
    mockUiState.statusMessage = message;
  }),
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
            statusMessage: mockUiState.statusMessage,
            setStatusMessage: mockSetStatusMessage,
            showFavoritesPanel: mockUiState.showFavoritesPanel,
            toggleFavoritesPanel: mockToggleFavoritesPanel,
          })
        : null,
    {
      getState: () => ({
        statusMessage: mockUiState.statusMessage,
        setStatusMessage: mockSetStatusMessage,
        showFavoritesPanel: mockUiState.showFavoritesPanel,
        toggleFavoritesPanel: mockToggleFavoritesPanel,
      }),
    }
  ),
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
    mockUiState.statusMessage = null;
    mockUiState.showFavoritesPanel = true;
    mockPanelState.activePanel = "left";
    mockPanelState.dragInfo = null;
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
    expect(mockSetStatusMessage).toHaveBeenCalledWith("즐겨찾기에 폴더를 추가했습니다.");
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
    expect(mockSetStatusMessage).toHaveBeenCalledWith("폴더만 즐겨찾기에 추가할 수 있습니다.");
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
    expect(mockSetStatusMessage).toHaveBeenCalledWith("이미 즐겨찾기에 등록된 폴더입니다.");
  });

  it("상태 메시지 타이머가 다음 테스트로 새지 않는다", async () => {
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

    expect(mockSetStatusMessage).toHaveBeenCalledWith("즐겨찾기에 폴더를 추가했습니다.");

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(mockSetStatusMessage).toHaveBeenLastCalledWith(null);
  });
});
