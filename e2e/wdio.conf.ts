// E2E 설정. 앱은 `npm run e2e:build`로 만든 debug 바이너리(e2e feature 포함)를 사용한다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binaryName = process.platform === "win32" ? "mycommander.exe" : "mycommander";

// 실제 앱 데이터(window-state, 크기 캐시, 작업 큐)를 건드리지 않도록 HOME을 임시 폴더로 바꿔 앱을 띄운다.
let tempHome = "";

export const config = {
  runner: "local",
  // 작업(복사·삭제)을 만드는 스펙은 마지막에 실행한다. 진행 대화상자가 닫히지 않는 상태로 남아도 다른 스펙에 영향이 없게 한다.
  specs: ["./specs/ui/**/*.e2e.ts", "./specs/jobs/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: path.join(rootDir, "src-tauri", "target", "debug", binaryName),
      },
    },
  ],
  services: [["tauri", { driverProvider: "embedded" }]],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 60000 },
  logLevel: "warn",

  // 워커와 앱은 이 프로세스의 환경변수를 상속하므로, 워커가 뜨기 전에 설정한다.
  onPrepare() {
    tempHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mycommander-e2e-")));
    for (const name of ["alpha.txt", "bravo.txt", "charlie.txt"]) {
      fs.writeFileSync(path.join(tempHome, name), name);
    }
    fs.mkdirSync(path.join(tempHome, "한글폴더"));
    // 앱이 첫 실행 직후 HOME/Library/Application Support에 캐시를 쓰면 Library 폴더가 목록에 뒤늦게 끼어들어
    // 커서 인덱스가 한 칸 밀린다. 목록이 도중에 바뀌지 않도록 미리 만들어 둔다.
    fs.mkdirSync(path.join(tempHome, "Library", "Application Support", "com.mycommander.desktop"), { recursive: true });
    process.env.HOME = tempHome;
    process.env.E2E_HOME = tempHome;
  },

  // 스펙 파일이 바뀌어도 앱 프로세스는 재시작되지 않고 같은 인스턴스를 쓴다(performance.timeOrigin으로 확인).
  // 앞 스펙이 남긴 대화상자(예: "Deleting Files..." 진행 대화상자)가 다음 스펙의 클릭을 막은 적이 있어
  // (CI 실행 45837773620 등) 테스트마다 화면을 새로고침하고 남은 대화상자를 닫는다.
  async beforeTest() {
    const { resetUiState } = await import("./helpers/navigation");
    await resetUiState();
  },

  // 실패한 테스트의 스크린샷과 화면 상태를 e2e/artifacts에 남긴다(CI에서 아티팩트로 올린다).
  async afterTest(test: { title: string }, _context: unknown, result: { passed: boolean }) {
    if (result.passed) {
      return;
    }
    const outDir = path.join(rootDir, "e2e", "artifacts");
    fs.mkdirSync(outDir, { recursive: true });
    const safeName = test.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60);
    const { browser } = await import("@wdio/globals");
    await browser.saveScreenshot(path.join(outDir, `${safeName}.png`)).catch(() => undefined);
    const state = await browser
      .execute(() => ({
        activeElement: `${document.activeElement?.tagName}/${document.activeElement?.getAttribute("role")}`,
        hasFocus: document.hasFocus(),
        visibility: document.visibilityState,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        entries: Array.from(document.querySelectorAll<HTMLElement>("[data-entry-name]")).slice(0, 30).map((el) => el.dataset.entryName),
      }))
      .catch((error: unknown) => ({ error: String(error) }));
    fs.writeFileSync(path.join(outDir, `${safeName}.json`), JSON.stringify(state, null, 2));
  },

  onComplete() {
    // 디버깅용: E2E_KEEP_HOME=1이면 임시 HOME을 지우지 않고 경로를 출력한다.
    if (process.env.E2E_KEEP_HOME === "1") {
      console.log(`[e2e] 임시 HOME 보존: ${tempHome}`);
      return;
    }
    if (tempHome.startsWith(os.tmpdir()) || tempHome.startsWith(fs.realpathSync(os.tmpdir()))) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  },
};
