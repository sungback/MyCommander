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

  it("setFontSize updates fontSize", () => {
    useSettingsStore.getState().setFontSize(16);
    expect(useSettingsStore.getState().fontSize).toBe(16);
  });

  it("setPanelLeftRatio updates panelLeftRatio", () => {
    useSettingsStore.getState().setPanelLeftRatio(60);
    expect(useSettingsStore.getState().panelLeftRatio).toBe(60);
  });

  it("starts with default column widths", () => {
    const state = useSettingsStore.getState();
    expect(state.columnWidths).toEqual({ size: 96, date: 144 });
  });

  it("updates column widths with clamping", () => {
    const store = useSettingsStore.getState();
    store.setColumnWidth("size", 150);
    expect(useSettingsStore.getState().columnWidths.size).toBe(150);

    // 최소치 미만이면 최소치로 clamp
    store.setColumnWidth("size", 20);
    expect(useSettingsStore.getState().columnWidths.size).toBe(60);

    // 최대치 초과면 최대치로 clamp
    store.setColumnWidth("date", 500);
    expect(useSettingsStore.getState().columnWidths.date).toBe(320);
  });

  it("resets column widths to default", () => {
    const store = useSettingsStore.getState();
    store.setColumnWidth("size", 180);
    store.setColumnWidth("date", 220);
    store.resetColumnWidths();
    expect(useSettingsStore.getState().columnWidths).toEqual({ size: 96, date: 144 });
  });

  it("merge migrates legacy uiFontFamily to fontFamily", () => {
    localStorage.setItem(
      "mycommander-settings",
      JSON.stringify({ state: { uiFontFamily: "system", fontSize: 16 }, version: 0 })
    );
    useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().fontFamily).toBe(DEFAULT_FONT_FAMILY);
    localStorage.removeItem("mycommander-settings");
  });

  it("merge migrates legacy monoFontFamily to fontFamily", () => {
    localStorage.setItem(
      "mycommander-settings",
      JSON.stringify({ state: { monoFontFamily: "MonoFont", fontSize: 14 }, version: 0 })
    );
    useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().fontFamily).toBe("MonoFont");
    localStorage.removeItem("mycommander-settings");
  });
});
