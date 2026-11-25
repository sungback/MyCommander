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
  specs: ["./specs/**/*.e2e.ts"],
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
    process.env.HOME = tempHome;
    process.env.E2E_HOME = tempHome;
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
