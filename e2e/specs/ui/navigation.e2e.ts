import fs from "node:fs";
import path from "node:path";
import { expect } from "@wdio/globals";
import { createFixtureDir, entryIn, goHome, openEntry } from "../../helpers/navigation";

describe("폴더 이동", () => {
  it("폴더로 들어갔다가 \"..\"로 돌아온다 (한글 폴더 이름 포함)", async () => {
    const root = createFixtureDir("nav");
    fs.mkdirSync(path.join(root, "한글폴더"));
    fs.writeFileSync(path.join(root, "한글폴더", "inner.txt"), "inner");

    const panel = await goHome(0);
    await openEntry(panel, "nav");
    await openEntry(panel, "한글폴더");
    await entryIn(panel, "inner.txt").waitForDisplayed({ timeout: 20000, timeoutMsg: "폴더 안 항목이 보이지 않습니다" });

    await openEntry(panel, "..");
    await entryIn(panel, "한글폴더").waitForDisplayed({ timeout: 20000, timeoutMsg: "상위 폴더로 돌아오지 않았습니다" });
    await expect(entryIn(panel, "inner.txt")).not.toExist();
  });
});
