import { describe, expect, it } from "vitest";
import {
  BOTTOM_ACTION_COUNT,
  createBottomActionDefinitions,
} from "./bottomActions";

describe("bottomActions", () => {
  it("keeps the bottom action count fixed at 8 on macOS", () => {
    const actions = createBottomActionDefinitions(true);

    expect(actions).toHaveLength(BOTTOM_ACTION_COUNT);
  });

  it("keeps the bottom action count fixed at 8 on Windows/Linux", () => {
    const actions = createBottomActionDefinitions(false);

    expect(actions).toHaveLength(BOTTOM_ACTION_COUNT);
  });

  it("preserves the action order and ids", () => {
    const actions = createBottomActionDefinitions(true);

    expect(actions.map((action) => action.id)).toEqual([
      "preview",
      "edit",
      "copy",
      "move",
      "mkdir",
      "delete",
      "search",
      "quit",
    ]);
  });

  it("keeps platform-specific accelerator labels only where expected", () => {
    const macActions = createBottomActionDefinitions(true);
    const windowsActions = createBottomActionDefinitions(false);

    expect(macActions.find((action) => action.id === "search")?.keyLabel).toBe("Option+F7");
    expect(windowsActions.find((action) => action.id === "search")?.keyLabel).toBe("Alt+F7");
    expect(macActions.find((action) => action.id === "quit")?.keyLabel).toBe("Cmd+Q");
    expect(windowsActions.find((action) => action.id === "quit")?.keyLabel).toBe("Alt+F4");
  });
});
