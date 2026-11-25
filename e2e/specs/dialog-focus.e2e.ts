import { browser, $ } from "@wdio/globals";
import { Key } from "webdriverio";
import { cursorEntryName, goHomeInFirstPanel, pointerClick } from "../helpers/navigation";

describe("대화상자를 닫은 뒤 포커스 복구", () => {
  it("F2 이름 바꾸기 → Esc 뒤 목록이 포커스를 받고 방향키가 동작한다", async () => {
    const panel = await goHomeInFirstPanel();

    // 임시 HOME의 항목이 보이는지 확인한다(데이터 격리 확인).
    const alpha = panel.$('[data-entry-name="alpha.txt"]');
    await alpha.waitForDisplayed({ timeout: 20000 });

    await pointerClick(alpha);
    await browser.waitUntil(async () => (await cursorEntryName()) === "alpha.txt", {
      timeoutMsg: "alpha.txt에 커서가 놓이지 않았습니다",
    });

    await browser.keys([Key.F2]);
    const dialog = $('[role="dialog"]');
    await dialog.waitForDisplayed({ timeout: 10000, timeoutMsg: "F2로 이름 바꾸기 대화상자가 열리지 않았습니다" });

    await browser.keys([Key.Escape]);
    await dialog.waitForExist({ reverse: true, timeout: 10000, timeoutMsg: "Esc로 대화상자가 닫히지 않았습니다" });

    // 핵심: 포커스가 활성 패널 목록으로 돌아와야 한다.
    await browser.waitUntil(
      async () =>
        browser.execute(() => {
          const active = document.activeElement as HTMLElement | null;
          return active?.getAttribute("role") === "listbox";
        }),
      { timeoutMsg: "대화상자를 닫은 뒤 포커스가 파일 목록으로 돌아오지 않았습니다" },
    );

    await browser.keys([Key.ArrowDown]);
    await browser.waitUntil(async () => (await cursorEntryName()) === "bravo.txt", {
      timeoutMsg: "Esc 뒤 ArrowDown으로 커서가 다음 항목으로 이동하지 않았습니다",
    });
  });
});
