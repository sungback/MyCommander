import { describe, expect, it } from "vitest";
import { getFitScale, getPageForKey } from "./pageNavigation";

describe("pageNavigation", () => {
  it("moves one page with arrow and page keys within bounds", () => {
    expect(getPageForKey("ArrowDown", 1, 3)).toBe(2);
    expect(getPageForKey("ArrowRight", 2, 3)).toBe(3);
    expect(getPageForKey("PageDown", 3, 3)).toBe(3);
    expect(getPageForKey("ArrowUp", 2, 3)).toBe(1);
    expect(getPageForKey("ArrowLeft", 1, 3)).toBe(1);
    expect(getPageForKey("PageUp", 3, 3)).toBe(2);
  });

  it("jumps to the first and last page and ignores other keys", () => {
    expect(getPageForKey("Home", 5, 9)).toBe(1);
    expect(getPageForKey("End", 1, 9)).toBe(9);
    expect(getPageForKey(" ", 1, 9)).toBeNull();
    expect(getPageForKey("Escape", 1, 9)).toBeNull();
    expect(getPageForKey("ArrowDown", 1, 0)).toBeNull();
  });

  it("fits the whole page inside the area", () => {
    expect(getFitScale({ width: 600, height: 800 }, 300, 1000)).toBe(0.5);
    expect(getFitScale({ width: 600, height: 800 }, 1200, 400)).toBe(0.5);
    expect(getFitScale({ width: 0, height: 800 }, 300, 400)).toBe(1);
  });
});
