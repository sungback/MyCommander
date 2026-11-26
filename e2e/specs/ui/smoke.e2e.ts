import { browser, $, $$, expect } from "@wdio/globals";

const PANEL_SELECTOR = '[role="listbox"][data-panel-id]';

async function countElements(parent: ChainablePromiseElement | null, selector: string): Promise<number> {
  const elements = parent ? await parent.$$(selector) : await $$(selector);
  return elements.length;
}

describe("앱 기동 스모크", () => {
  it("두 패널의 파일 목록이 표시된다", async () => {
    await browser.waitUntil(async () => (await countElements(null, PANEL_SELECTOR)) === 2, {
      timeout: 20000,
      timeoutMsg: "파일 패널 2개가 나타나지 않았습니다",
    });
    const firstPanel = $(PANEL_SELECTOR);
    await expect(firstPanel).toBeDisplayed();
    await browser.waitUntil(async () => (await countElements(firstPanel, "[data-entry-path]")) > 0, {
      timeout: 20000,
      timeoutMsg: "패널에 항목이 하나도 없습니다",
    });
  });
});
