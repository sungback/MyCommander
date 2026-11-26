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

// 조건이 맞을 때까지 동작을 반복한다. CI 러너처럼 느린 환경에서 클릭·키 입력이 화면 갱신과 겹쳐 유실되는 경우를 흡수한다.
// 끝 상태 검증(done)은 그대로 유지하므로 실제 동작이 틀리면 시간 초과로 실패한다. done을 먼저 확인하므로 성공 뒤에는 반복하지 않는다.
export async function repeatUntil(
  action: () => Promise<void>,
  done: () => Promise<boolean>,
  message: string,
  timeout = 15000,
): Promise<void> {
  await browser.waitUntil(
    async () => {
      if (await done()) {
        return true;
      }
      await action();
      await browser.pause(300);
      return done();
    },
    { timeout, interval: 200, timeoutMsg: message },
  );
}

// 패널에 보이는 항목 경로 목록. 폴더를 열거나 상위로 이동하면 달라진다.
async function entryPathsSnapshot(panel: ReturnType<typeof $>): Promise<string> {
  const panelElement = await panel;
  return browser.execute(
    (element: HTMLElement) =>
      Array.from(element.querySelectorAll<HTMLElement>("[data-entry-path]"))
        .map((entry) => entry.dataset.entryPath)
        .join("\n"),
    panelElement as unknown as HTMLElement,
  );
}

// 항목을 클릭해 커서를 놓는다. 커서가 놓일 때까지 반복한다.
export async function selectEntry(panel: ReturnType<typeof $>, name: string): Promise<void> {
  await entryIn(panel, name).waitForDisplayed({ timeout: 20000, timeoutMsg: `${name} 항목이 보이지 않습니다` });
  await repeatUntil(
    () => pointerClick(entryIn(panel, name)),
    async () => (await cursorEntryName()) === name,
    `${name}에 커서가 놓이지 않았습니다`,
  );
}

// 항목에 커서를 놓고 Enter로 연다(폴더 진입, ".."는 상위 이동). 목록이 바뀔 때까지 반복한다.
// Enter는 커서가 대상에 있을 때만 보내, 다른 폴더를 잘못 여는 일이 없게 한다.
export async function openEntry(panel: ReturnType<typeof $>, name: string): Promise<void> {
  await entryIn(panel, name).waitForDisplayed({ timeout: 20000, timeoutMsg: `${name} 항목이 보이지 않습니다` });
  const before = await entryPathsSnapshot(panel);
  await repeatUntil(
    async () => {
      await pointerClick(entryIn(panel, name));
      if ((await cursorEntryName()) === name) {
        await browser.keys([Key.Enter]);
      }
    },
    async () => (await entryPathsSnapshot(panel)) !== before,
    `${name}을(를) 열었는데 목록이 바뀌지 않았습니다`,
  );
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

const JOB_FILE = () =>
  path.join(process.env.E2E_HOME as string, "Library", "Application Support", "com.mycommander.desktop", "job-queue.json");

// 작업(복사·삭제 등)이 끝나고 그 상태가 job-queue.json에 저장될 때까지 기다린다.
// 저장 전에 앱이 종료되면 다음 실행에서 queued 작업이 복원되어 진행 대화상자가 클릭을 막는다.
export async function waitForJobsSettled(): Promise<void> {
  await browser.waitUntil(
    async () => {
      try {
        const state = JSON.parse(fs.readFileSync(JOB_FILE(), "utf8")) as { jobs: { record: { status: string } }[] };
        return state.jobs.length > 0 && state.jobs.every((job) => !["queued", "running"].includes(job.record.status));
      } catch {
        return false;
      }
    },
    { timeout: 15000, interval: 200, timeoutMsg: "작업 상태가 job-queue.json에 completed로 저장되지 않았습니다" },
  );
}
