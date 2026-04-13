# panelStore & __unresolved__::ref::_zustand_
Cohesion: 0.18 | Nodes: 11

## Key Nodes
- **panelStore** (/Users/sungback/Documents/MyCommander/src/store/panelStore.ts) -- 7 connections
  - -> contains -> [[appstate]]
  - -> contains -> [[persistedpanelstate]]
  - -> contains -> [[persistedpaneldata]]
  - -> contains -> [[persistedtabstate]]
  - -> imports -> [[unresolvedrefzustand]]
  - -> imports -> [[unresolvedreftypesfile]]
  - -> imports -> [[unresolvedreftypestheme]]
- **__unresolved__::ref::_zustand_** () -- 4 connections
  - <- imports <- [[panelstore]]
  - <- imports <- [[dialogstore]]
  - <- imports <- [[uistore]]
  - <- imports <- [[contextmenustore]]
- **__unresolved__::ref::_types_theme_** () -- 2 connections
  - <- imports <- [[app]]
  - <- imports <- [[panelstore]]
- **contextMenuStore** (/Users/sungback/Documents/MyCommander/src/store/contextMenuStore.ts) -- 2 connections
  - -> contains -> [[contextmenustate]]
  - -> imports -> [[unresolvedrefzustand]]
- **uiStore** (/Users/sungback/Documents/MyCommander/src/store/uiStore.ts) -- 2 connections
  - -> contains -> [[uistate]]
  - -> imports -> [[unresolvedrefzustand]]
- **ContextMenuState** (/Users/sungback/Documents/MyCommander/src/store/contextMenuStore.ts) -- 1 connections
  - <- contains <- [[contextmenustore]]
- **AppState** (/Users/sungback/Documents/MyCommander/src/store/panelStore.ts) -- 1 connections
  - <- contains <- [[panelstore]]
- **PersistedPanelData** (/Users/sungback/Documents/MyCommander/src/store/panelStore.ts) -- 1 connections
  - <- contains <- [[panelstore]]
- **PersistedPanelState** (/Users/sungback/Documents/MyCommander/src/store/panelStore.ts) -- 1 connections
  - <- contains <- [[panelstore]]
- **PersistedTabState** (/Users/sungback/Documents/MyCommander/src/store/panelStore.ts) -- 1 connections
  - <- contains <- [[panelstore]]
- **UiState** (/Users/sungback/Documents/MyCommander/src/store/uiStore.ts) -- 1 connections
  - <- contains <- [[uistore]]

## Internal Relationships
- contextMenuStore -> contains -> ContextMenuState [EXTRACTED]
- contextMenuStore -> imports -> __unresolved__::ref::_zustand_ [EXTRACTED]
- panelStore -> contains -> AppState [EXTRACTED]
- panelStore -> contains -> PersistedPanelState [EXTRACTED]
- panelStore -> contains -> PersistedPanelData [EXTRACTED]
- panelStore -> contains -> PersistedTabState [EXTRACTED]
- panelStore -> imports -> __unresolved__::ref::_zustand_ [EXTRACTED]
- panelStore -> imports -> __unresolved__::ref::_types_theme_ [EXTRACTED]
- uiStore -> contains -> UiState [EXTRACTED]
- uiStore -> imports -> __unresolved__::ref::_zustand_ [EXTRACTED]

## Cross-Community Connections
- panelStore -> imports -> __unresolved__::ref::_types_file_ (-> [[app-unresolvedrefreact]])

## Context
이 커뮤니티는 panelStore, __unresolved__::ref::_zustand_, __unresolved__::ref::_types_theme_를 중심으로 contains 관계로 연결되어 있다. 주요 소스 파일은 contextMenuStore.ts, panelStore.ts, uiStore.ts이다.

### Key Facts
- export const usePanelStore = create<AppState>((set) => { const persistedPanelState = readPersistedPanelState(); const panelViewModes: PanelViewModes = { left: persistedPanelState.leftViewMode ?? persistedPanelState.viewMode ?? "detailed", right: persistedPanelState.rightViewMode ??…
- export const useContextMenuStore = create<ContextMenuState>((set) => ({ isOpen: false, panelId: null, targetPath: null, x: 0, y: 0, openContextMenu: ({ panelId, targetPath = null, x, y }) => set({ isOpen: true, panelId, targetPath, x, y, }), closeContextMenu: () => set({ isOpen: false, panelId:…
- export const useUiStore = create<UiState>((set) => ({ statusMessage: null, setStatusMessage: (statusMessage) => set({ statusMessage }), }));
- interface ContextMenuState { isOpen: boolean; panelId: "left" | "right" | null; targetPath: string | null; x: number; y: number; openContextMenu: (payload: { panelId: "left" | "right"; targetPath?: string | null; x: number; y: number; }) => void; closeContextMenu: () => void; }
- interface AppState { leftPanel: PanelState; rightPanel: PanelState; sizeCache: Record<string, number>; activePanel: PanelId; showHiddenFiles: boolean; themePreference: ThemePreference; panelViewModes: PanelViewModes; setActivePanel: (panel: PanelId) => void; setShowHiddenFiles: (show: boolean) =>…
