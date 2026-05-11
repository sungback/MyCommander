import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";
import type { PanelId, PanelState, PanelTabState } from "../../types/file";

const { mockSetActivePanel, mockAddTab, mockActivateTab, mockCloseTab } =
  vi.hoisted(() => ({
    mockSetActivePanel: vi.fn(),
    mockAddTab: vi.fn(),
    mockActivateTab: vi.fn(),
    mockCloseTab: vi.fn(),
  }));

const makeTab = (id: string, currentPath: string): PanelTabState => ({
  id,
  currentPath,
  resolvedPath: undefined,
  history: [currentPath],
  historyIndex: 0,
  files: [],
  selectedItems: new Set(),
  cursorIndex: 0,
  sortField: "name",
  sortDirection: "asc",
  lastUpdated: 0,
  pendingCursorName: null,
  expandedChildrenVersion: 0,
});

const makePanel = (id: PanelId, tab: PanelTabState): PanelState => ({
  id,
  currentPath: tab.currentPath,
  resolvedPath: tab.resolvedPath,
  history: tab.history,
  historyIndex: tab.historyIndex,
  files: tab.files,
  selectedItems: tab.selectedItems,
  cursorIndex: tab.cursorIndex,
  sortField: tab.sortField,
  sortDirection: tab.sortDirection,
  lastUpdated: tab.lastUpdated,
  pendingCursorName: tab.pendingCursorName,
  tabs: [tab],
  activeTabId: tab.id,
});

const rootTab = makeTab("root-tab", "/");
const mockPanelState = {
  leftPanel: makePanel("left", rootTab),
  rightPanel: makePanel("right", makeTab("right-tab", "/home/user")),
  setActivePanel: mockSetActivePanel,
  addTab: mockAddTab,
  activateTab: mockActivateTab,
  closeTab: mockCloseTab,
};

vi.mock("../../store/panelStore", () => ({
  usePanelStore: (selector: (state: typeof mockPanelState) => unknown) =>
    selector(mockPanelState),
}));

describe("TabBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
    mockPanelState.leftPanel = makePanel("left", rootTab);
  });

  it("macOS 루트 탭은 Macintosh HD로 표시한다", () => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });

    render(<TabBar panelId="left" />);

    expect(screen.getByText("Macintosh HD")).toBeInTheDocument();
  });
});
