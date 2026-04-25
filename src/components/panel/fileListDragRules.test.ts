import { describe, expect, it } from "vitest";
import {
  getPanelIdFromElement,
  resolveCrossPanelDropIntent,
  resolveMouseUpTargetPanel,
  resolveSamePanelDropIntent,
} from "./fileListDragRules";

describe("fileListDragRules", () => {
  it("reads panel ids from panel DOM elements only", () => {
    const leftPanel = document.createElement("div");
    leftPanel.dataset.panelId = "left";
    const invalidPanel = document.createElement("div");
    invalidPanel.dataset.panelId = "middle";

    expect(getPanelIdFromElement(leftPanel)).toBe("left");
    expect(getPanelIdFromElement(invalidPanel)).toBeNull();
    expect(getPanelIdFromElement(null)).toBeNull();
  });

  it("prefers shared hovered panel and ignores same-panel pointer fallback", () => {
    expect(
      resolveMouseUpTargetPanel({
        sourcePanel: "left",
        hoveredPanel: "right",
        hoveredPanelFromPointer: "left",
      })
    ).toBe("right");
    expect(
      resolveMouseUpTargetPanel({
        sourcePanel: "left",
        hoveredPanel: null,
        hoveredPanelFromPointer: "left",
      })
    ).toBeNull();
    expect(
      resolveMouseUpTargetPanel({
        sourcePanel: "left",
        hoveredPanel: null,
        hoveredPanelFromPointer: "right",
      })
    ).toBe("right");
  });

  it("recognizes folder-only same-panel drops as move intents", () => {
    expect(
      resolveSamePanelDropIntent({
        sourcePanel: "left",
        targetPanel: null,
        activeDragInfo: {
          sourcePanel: "left",
          paths: ["/source/folder"],
          directoryPaths: ["/source/folder"],
        },
        dropTargetPath: "/target",
        isDropAllowed: true,
        blockedReason: null,
      })
    ).toEqual({
      targetPath: "/target",
      isDropAllowed: true,
      blockedReason: null,
      isFolderOnlyMove: true,
    });
  });

  it("uses shared drop target block state for cross-panel folder drops", () => {
    expect(
      resolveCrossPanelDropIntent({
        sourcePanel: "left",
        targetPanel: "right",
        activeDragInfo: {
          sourcePanel: "left",
          paths: ["/source/folder"],
          directoryPaths: ["/source/folder"],
        },
        dropTargetPath: "/source/folder/child",
        hoveredPanelPath: "/right",
        fallbackPanelPath: "/right",
        destinationPanelPath: "/right",
        isDropAllowed: false,
        blockedReason: "blocked",
      })
    ).toEqual({
      targetPanel: "right",
      targetPath: "/source/folder/child",
      blockedReason: "blocked",
    });
  });

  it("falls back to panel paths and computes cross-panel nested blocks", () => {
    expect(
      resolveCrossPanelDropIntent({
        sourcePanel: "left",
        targetPanel: "right",
        activeDragInfo: {
          sourcePanel: "left",
          paths: ["/source/folder"],
          directoryPaths: ["/source/folder"],
        },
        dropTargetPath: null,
        hoveredPanelPath: null,
        fallbackPanelPath: "",
        destinationPanelPath: "/source/folder/child",
        isDropAllowed: false,
        blockedReason: null,
      })
    ).toEqual({
      targetPanel: "right",
      targetPath: "/source/folder/child",
      blockedReason: "폴더를 자기 자신 안이나 하위 폴더로 복사할 수 없습니다.",
    });
  });
});
