import { describe, expect, it } from "vitest";
import {
  createRenderLimiter,
  getFitScale,
  getPdfPageForKey,
  isPdfPasswordError,
  isPdfRenderCancelled,
} from "./pdfPreviewHelpers";

describe("pdfPreviewHelpers", () => {
  it("moves one page with arrow and page keys within bounds", () => {
    expect(getPdfPageForKey("ArrowDown", 1, 3)).toBe(2);
    expect(getPdfPageForKey("ArrowRight", 2, 3)).toBe(3);
    expect(getPdfPageForKey("PageDown", 3, 3)).toBe(3);
    expect(getPdfPageForKey("ArrowUp", 2, 3)).toBe(1);
    expect(getPdfPageForKey("ArrowLeft", 1, 3)).toBe(1);
    expect(getPdfPageForKey("PageUp", 3, 3)).toBe(2);
  });

  it("jumps to the first and last page and ignores other keys", () => {
    expect(getPdfPageForKey("Home", 5, 9)).toBe(1);
    expect(getPdfPageForKey("End", 1, 9)).toBe(9);
    expect(getPdfPageForKey(" ", 1, 9)).toBeNull();
    expect(getPdfPageForKey("Escape", 1, 9)).toBeNull();
    expect(getPdfPageForKey("ArrowDown", 1, 0)).toBeNull();
  });

  it("fits the whole page inside the area", () => {
    expect(getFitScale({ width: 600, height: 800 }, 300, 1000)).toBe(0.5);
    expect(getFitScale({ width: 600, height: 800 }, 1200, 400)).toBe(0.5);
    expect(getFitScale({ width: 0, height: 800 }, 300, 400)).toBe(1);
  });

  it("limits concurrent jobs and skips cancelled ones", async () => {
    const limiter = createRenderLimiter(2);
    let running = 0;
    let maxRunning = 0;
    const releases: Array<() => void> = [];
    const job = () =>
      new Promise<void>((resolve) => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        releases.push(() => {
          running -= 1;
          resolve();
        });
      });
    let skippedRan = false;

    const first = limiter.run(job, () => false);
    const second = limiter.run(job, () => false);
    const skipped = limiter.run(async () => {
      skippedRan = true;
    }, () => true);
    const third = limiter.run(job, () => false);
    await Promise.resolve();

    expect(maxRunning).toBe(2);
    releases.shift()?.();
    releases.shift()?.();
    await Promise.all([first, second, skipped]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releases.shift()?.();
    await third;

    expect(skippedRan).toBe(false);
    expect(maxRunning).toBe(2);
  });

  it("recognizes pdf.js password and cancellation errors by name", () => {
    expect(isPdfPasswordError({ name: "PasswordException" })).toBe(true);
    expect(isPdfPasswordError(new Error("broken"))).toBe(false);
    expect(isPdfRenderCancelled({ name: "RenderingCancelledException" })).toBe(true);
    expect(isPdfRenderCancelled(null)).toBe(false);
  });
});
