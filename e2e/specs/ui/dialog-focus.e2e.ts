import { browser, $ } from "@wdio/globals";
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

    // 폴더로 이동한 직후에는 한 번 옮긴 커서가 잠시 뒤 되돌려지는 현상이 있어(대화상자와 무관하게 재현됨),
    // 커서가 bravo.txt에 놓인 채 0.7초 동안 유지될 때까지 방향키를 반복한다.
    await repeatUntil(
      () => browser.keys([Key.ArrowDown]),
      async () => {
        if ((await cursorEntryName()) !== "bravo.txt") {
          return false;
        }
        await browser.pause(700);
        return (await cursorEntryName()) === "bravo.txt";
      },
      "Esc 뒤 ArrowDown으로 커서가 다음 항목(bravo.txt)에 머물지 않았습니다",
    );
  });
});
