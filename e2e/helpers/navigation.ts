import fs from "node:fs";
import path from "node:path";
import { $, $$, browser } from "@wdio/globals";
import { Key } from "webdriverio";

export const PANEL_SELECTOR = '[role="listbox"][data-panel-id]';

// 앱은 저장된 상태가 없으면 루트("/")에서 시작한다. 임시 HOME의 픽스처를 보려면 홈 버튼으로 이동한다.
// 첫 번째 주소 표시줄과 첫 번째 패널이 왼쪽 패널이다.
export async function goHomeInFirstPanel(): Promise<ReturnType<typeof $>> {
  const panel = $(PANEL_SELECTOR);
  await panel.waitForDisplayed({ timeout: 20000 });
  await $('button[title="Go to home directory"]').click();
  return panel;
}

// 임베디드 드라이버의 element.click()은 mousedown·포커스 이벤트를 일으키지 않아 앱이 선택·포커스를 처리하지 않는다.
// 실제 마우스처럼 동작하는 포인터 액션으로 클릭한다.
export async function pointerClick(element: ReturnType<typeof $>): Promise<void> {
  await browser.action("pointer").move({ origin: element }).down().up().perform();
}

// 커서 행은 data 속성이 없고, data-entry-name 래퍼의 첫 자식에 붙는 강조 클래스(FileItem.tsx의 isCursor)로만 구분된다.
export async function cursorEntryName(): Promise<string | null> {
  return browser.execute(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-entry-name]"));
    const cursorRow = rows.find((row) => row.firstElementChild?.classList.contains("ring-accent-color/70"));
    return cursorRow?.dataset.entryName ?? null;
  });
}

// 왼쪽(0)·오른쪽(1) 패널.
export async function panelAt(index: number): Promise<ReturnType<typeof $>> {
  const panels = await $$(PANEL_SELECTOR);
  return panels[index];
}

export async function goHome(panelIndex: number): Promise<ReturnType<typeof $>> {
  const panel = await panelAt(panelIndex);
  await panel.waitForDisplayed({ timeout: 20000 });
  const homeButtons = await $$('button[title="Go to home directory"]');
  await pointerClick(homeButtons[panelIndex]);
  return panel;
}

export function entryIn(panel: ReturnType<typeof $>, name: string): ReturnType<typeof $> {
  return panel.$(`[data-entry-name="${name}"]`);
}

// 항목을 클릭해 커서를 놓고 Enter로 연다(폴더 진입, ".."는 상위 이동).
export async function openEntry(panel: ReturnType<typeof $>, name: string): Promise<void> {
  const entry = entryIn(panel, name);
  await entry.waitForDisplayed({ timeout: 20000, timeoutMsg: `${name} 항목이 보이지 않습니다`});
  await pointerClick(entry);
  await browser.keys([Key.Enter]);
}

// 이 스펙 전용 픽스처 폴더를 임시 HOME 아래에 만든다.
export function createFixtureDir(name: string, files: Record<string, string> = {}): string {
  const dir = path.join(process.env.E2E_HOME as string, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, fileName), content);
  }
  return dir;
}
