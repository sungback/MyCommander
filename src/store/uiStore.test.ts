import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ showFavoritesPanel: true });
  });

  it("초기 상태: showFavoritesPanel = true", () => {
    expect(useUiStore.getState().showFavoritesPanel).toBe(true);
  });

  it("toggleFavoritesPanel: true → false", () => {
    useUiStore.getState().toggleFavoritesPanel();
    expect(useUiStore.getState().showFavoritesPanel).toBe(false);
  });

  it("toggleFavoritesPanel: false → true", () => {
    useUiStore.setState({ showFavoritesPanel: false });
    useUiStore.getState().toggleFavoritesPanel();
    expect(useUiStore.getState().showFavoritesPanel).toBe(true);
  });
});
