import { browser, $, expect } from "@wdio/globals";
import { Key } from "webdriverio";
import { cursorEntryName, goHomeInFirstPanel, repeatUntil, selectEntry } from "../../helpers/navigation";

describe("대화상자를 닫은 뒤 포커스 복구", () => {
  it("F2 이름 바꾸기 → Esc 뒤 목록이 포커스를 받고 방향키가 동작한다", async () => {
    const panel = await goHomeInFirstPanel();

    // 임시 HOME의 항목이 보이는지 확인한다(데이터 격리 확인). 커서가 놓일 때까지 클릭을 반복한다.
    await selectEntry(panel, "alpha.txt");

    const dialog = $('[role="dialog"]');
    await repeatUntil(
      () => browser.keys([Key.F2]),
      () => dialog.isDisplayed(),
      "F2로 이름 바꾸기 대화상자가 열리지 않았습니다",
    );

    await repeatUntil(
      () => browser.keys([Key.Escape]),
      async () => !(await dialog.isExisting()),
      "Esc로 대화상자가 닫히지 않았습니다",
    );

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
      timeoutMsg: "Esc 뒤 ArrowDown으로 커서가 다음 항목(bravo.txt)으로 이동하지 않았습니다",
    });

    // 목록이 뒤늦게 갱신돼도 커서가 같은 항목에 머무는지 확인한다(커서가 인덱스로만 추적되면 이웃 항목으로 튄다).
    await browser.pause(1000);
    expect(await cursorEntryName()).toBe("bravo.txt");
  });
});
