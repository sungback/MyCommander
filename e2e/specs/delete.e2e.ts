import fs from "node:fs";
import path from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { Key } from "webdriverio";
import { createFixtureDir, entryIn, goHome, openEntry, pointerClick, repeatUntil, selectEntry, waitForJobsSettled } from "../helpers/navigation";

// 휴지통 이동(F8)은 실제 사용자 휴지통에 파일이 쌓이므로, 영구 삭제(Shift+F8)로 검증한다.
describe("Shift+F8 영구 삭제", () => {
  it("선택한 파일만 디스크와 목록에서 삭제된다", async () => {
    const dir = createFixtureDir("delete-me", { "gone.txt": "bye", "keep.txt": "stay" });

    const panel = await goHome(0);
    await openEntry(panel, "delete-me");
    await selectEntry(panel, "gone.txt");

    const dialog = $('[role="dialog"]');
    await repeatUntil(
      () => browser.keys([Key.Shift, Key.F8]),
      () => dialog.isDisplayed(),
      "Shift+F8로 삭제 확인 대화상자가 열리지 않았습니다",
    );
    await expect(dialog).toHaveText(expect.stringContaining("gone.txt"));
    await pointerClick($('[role="dialog"] button[type="submit"]'));

    await entryIn(panel, "gone.txt").waitForExist({ reverse: true, timeout: 20000, timeoutMsg: "삭제한 파일이 목록에서 사라지지 않았습니다" });
    expect(fs.existsSync(path.join(dir, "gone.txt"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "keep.txt"))).toBe(true);
    await expect(entryIn(panel, "keep.txt")).toExist();
    await waitForJobsSettled();
  });
});
