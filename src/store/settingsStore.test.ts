import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FONT_FAMILY, buildFontFamilyStack } from "../constants/fontOptions";
import { useSettingsStore } from "./settingsStore";

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState());
});

describe("settingsStore", () => {
  it("starts with the default font settings", () => {
    const state = useSettingsStore.getState();

    expect(state.fontSize).toBe(14);
    expect(state.fontFamily).toBe("");
    expect(state.panelLeftRatio).toBe(50);
  });

  it("keeps empty input to use the default fallback", () => {
    const state = useSettingsStore.getState();
    state.setFontFamily("   ");

    expect(useSettingsStore.getState().fontFamily).toBe("");
    expect(buildFontFamilyStack(useSettingsStore.getState().fontFamily)).toBe(DEFAULT_FONT_FAMILY);
  });

  it("stores custom font family strings", () => {
    const state = useSettingsStore.getState();
    state.setFontFamily('D2Coding, "Noto Sans KR"');

    expect(useSettingsStore.getState().fontFamily).toBe(
      'D2Coding, "Noto Sans KR"'
    );
  });
});
