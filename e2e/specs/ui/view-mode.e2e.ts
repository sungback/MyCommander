import { browser } from "@wdio/globals";
import { Key } from "webdriverio";
import { goHome, repeatUntil, selectEntry } from "../../helpers/navigation";

// 상세 보기에서만 열 머리글(Name/Size/Date)이 그려진다. 보기 모드는 활성 패널에만 적용된다.
async function columnHeaderCount(): Promise<number> {
  return browser.execute(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>("div, span, button"));
    return labels.filter((el) => el.textContent?.trim() === "Name" && !el.closest('[role="listbox"]')).length;
  });
}

describe("Cmd+F1 / Cmd+F2 보기 전환", () => {
  it("활성 패널의 보기가 간단 ↔ 상세로 바뀐다", async () => {
    const panel = await goHome(0);
    await selectEntry(panel, "alpha.txt");

    await browser.waitUntil(async () => (await columnHeaderCount()) === 2, { timeoutMsg: "처음에 두 패널 모두 상세 보기가 아닙니다" });

    await repeatUntil(
      () => browser.keys([Key.Command, Key.F1]),
      async () => (await columnHeaderCount()) === 1,
      "Cmd+F1로 활성 패널이 간단 보기로 바뀌지 않았습니다",
    );

    await repeatUntil(
      () => browser.keys([Key.Command, Key.F2]),
      async () => (await columnHeaderCount()) === 2,
      "Cmd+F2로 활성 패널이 상세 보기로 돌아오지 않았습니다",
    );
  });
});
