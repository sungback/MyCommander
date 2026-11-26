import fs from "node:fs";
import path from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { Key } from "webdriverio";
import { createFixtureDir, entryIn, goHome, openEntry, pointerClick, repeatUntil, selectEntry } from "../helpers/navigation";

describe("F5 복사", () => {
  it("선택한 파일을 반대 패널 폴더로 복사한다", async () => {
    const src = createFixtureDir("copy-src", { "file.txt": "copy-me" });
    const dst = createFixtureDir("copy-dst");

    const left = await goHome(0);
    await openEntry(left, "copy-src");
    const right = await goHome(1);
    await openEntry(right, "copy-dst");

    await selectEntry(left, "file.txt");

    const dialog = $('[role="dialog"]');
    await repeatUntil(
      () => browser.keys([Key.F5]),
      () => dialog.isDisplayed(),
      "F5로 복사 대화상자가 열리지 않았습니다",
    );
    await pointerClick($('[role="dialog"] button[type="submit"]'));
    await dialog.waitForExist({ reverse: true, timeout: 20000, timeoutMsg: "복사 대화상자가 닫히지 않았습니다" });

    await entryIn(right, "file.txt").waitForDisplayed({ timeout: 20000, timeoutMsg: "반대 패널에 복사된 파일이 나타나지 않았습니다" });
    expect(fs.readFileSync(path.join(dst, "file.txt"), "utf8")).toBe("copy-me");
    expect(fs.existsSync(path.join(src, "file.txt"))).toBe(true);
  });
});
