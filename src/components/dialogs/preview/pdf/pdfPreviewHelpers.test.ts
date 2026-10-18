import { describe, expect, it } from "vitest";
import {
  createRenderLimiter,
  isPdfPasswordError,
  isPdfRenderCancelled,
} from "./pdfPreviewHelpers";

describe("pdfPreviewHelpers", () => {
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
