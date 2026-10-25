# MyCommander — CLAUDE.md

이 파일은 MyCommander 프로젝트의 현재 구현 상태, 아키텍처, 설계 정책을 빠르게 파악하기 위한 구현 컨텍스트 문서입니다.
사용자/기여자용 실행 안내는 [`README.md`](./README.md), 작업 절차와 검증 규칙은 [`AGENTS.md`](./AGENTS.md)를 우선 따릅니다.

---

## 문서 범위

- 현재 구현 상태, 핵심 구조, 설계 정책은 이 문서에 기록합니다.
- 에이전트 응답 방식, 검증 규칙, 커밋/빌드 위생은 [`AGENTS.md`](./AGENTS.md)에 기록합니다.
- 설치, 실행, 주요 기능, 사용자 관점 설명은 [`README.md`](./README.md)에 기록합니다.

---

## 프로젝트 개요

**MyCommander**는 **Tauri v2 + React 19 + TypeScript** 기반의 크로스플랫폼 데스크톱 파일 매니저입니다.
듀얼 패널 탐색, 탭과 히스토리, 즐겨찾기, 검색, 빠른 미리보기, 일괄 이름 변경, ZIP 작업, 폴더 비교/동기화, 패널/외부 드래그 드롭 복사 UX, 디렉터리 크기 계산/캐시를 포함합니다.

앱의 기본 화면 구성 요소: 좌측 즐겨찾기 패널, 좌/우 듀얼 파일 패널, 상태바 및 하단 액션 바, 토스트 뷰포트, 다이얼로그 기반 파일 작업 UI.

---

## 설계 정책

이 항목들은 의도적으로 결정된 동작입니다. 회귀를 방지하기 위해 변경하지 않습니다.

- **한글 파일명 NFC 보존:** 새 파일/폴더 이름 생성 시 NFD로 강제 정규화하지 않습니다. Windows로 복사할 때 한글이 분해되어 보이는 문제를 막기 위한 정책입니다.
- **새 파일 다이얼로그 기본값 빈 칸:** `New File.txt` 같은 프리필을 다시 넣지 않습니다.
- **macOS CloudStorage symlink:** `~/Dropbox` 같은 경로는 UI/히스토리에 표시 경로(`currentPath`)를 유지하고, 파일 시스템 접근/비교/감시는 해석된 경로(`resolvedPath`)를 사용합니다. 경로 비교·접근 지점은 `resolvedPath ?? currentPath` 패턴을 우선합니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Desktop Shell | Tauri v2, window-state plugin |
| Backend | Rust, Tauri custom commands |
| UI | Radix UI Dialog, Lucide React, `react-resizable-panels`, `re-resizable` |
| Virtualized List | `@tanstack/react-virtual` |
| Preview Helpers | `highlight.js`, `marked`, `read-excel-file`, `jszip`, `pdfjs-dist`, `pptxtojson`, `rusqlite` |
| Utilities | `date-fns`, `clsx`, `tailwind-merge` |
| Testing | Vitest, Testing Library |

---

## 프런트엔드 구조 메모

### 비명시적 동작 (코드만으로 파악하기 어려운 것)

- **자동 테마:** 07:00–19:00는 light, 그 외는 dark. 창 포커스 시 재평가.
- **토스트 피드백:** 짧은 성공/경고/오류는 `StatusBar` 인라인이 아닌 `toastStore` + `ToastViewport`로 표시. 긴 작업은 `ProgressDialog`, 이력은 `JobCenterDialog`.
- **앱 크래시 폴백:** `src/main.tsx`가 `ErrorBoundary`로 `App`을 감싸며, 렌더링 예외가 발생하면 앱 새로고침 버튼이 있는 전체 화면 오류 UI를 표시합니다.
- **패널 갱신:** 파일 생성/삭제/이름 변경/복사/이동 후 같은 디렉터리를 보고 있는 다른 패널도 함께 갱신. `panelRefresh`는 Zustand 덮어쓰기 방지를 위해 단일 `updatePanelTabs`로 일괄 처리.
- **더블클릭 진입:** 일반 디렉터리든 symlink든 실제 경로 접근 가능 여부를 먼저 확인 후 표시 경로로 상태를 갱신.
- **확장 트리 메타데이터:** `FileList.tsx`의 확장된 하위 폴더 항목 정보는 전역 상태가 아닌 DOM 속성(`data-entry-*`)에 저장. 컨텍스트 메뉴 등에서 하위 항목 처리 시 DOM에서 재구성 필요.
- **`panelStore` 경로 이중 구조:** `currentPath`(UI/히스토리 표시용) / `resolvedPath`(실제 파일시스템 접근용). 경로 비교·접근은 `resolvedPath ?? currentPath` 패턴 우선.
- **패널 보기 모드:** `panelViewModes`는 좌/우 패널별 `brief` / `detailed` 상태를 보관합니다. `Cmd/Ctrl+F1`은 brief, `Cmd/Ctrl+F2`는 detailed로 전환하며, 네이티브 메뉴 상태는 `useNativeMenuStateSync`가 동기화합니다.
- **프런트엔드 Tauri IPC 경계:** 프런트엔드의 직접 `invoke()` 호출은 `src/hooks/tauriCommands/` 하위 명령 클라이언트에만 둡니다. 컴포넌트와 일반 훅은 `useFileSystem()` facade를 통해 Tauri 명령을 호출합니다.
- **탭-패널 상태 동기화:** 활성 탭 상태를 패널 상단 상태로 반영하는 계약은 `src/utils/panelHelpers.ts`의 `syncPanelWithActiveTab`이 담당합니다. `panelRefresh` 같은 갱신 경로에서 별도 동기화 복사본을 만들지 않습니다.
- **렌더러 복구 (`useRendererRecovery`):** 30초마다 틱을 체크하여 2분 이상 간격이 감지되면 macOS sleep/wake 후 화면 고착으로 판단합니다. 포그라운드 전환 시 CSS pulse + Tauri 창/WebView `show()`로 복구를 시도하고, 고착 상태가 지속되면 1.5초 후 페이지 리로드합니다(쿨다운 1분). 사용자에게 투명하게 동작합니다.
- **페이지형 미리보기 공통 화면:** PDF와 PPTX는 `preview/paged/PagedPreviewLayout`을 함께 씁니다. 왼쪽 썸네일(보이는 것만 그림)과 현재 페이지 한 장을 보여 주고 ↑↓←→·PageUp/PageDown·Home/End로 넘깁니다(Space·Esc는 미리보기 창이 닫기로 처리).
- **PDF 빠른 미리보기:** `preview/pdf/`가 pdf.js(`pdfjs-dist`)로 직접 그립니다. 썸네일은 동시에 2개까지 그리고 PNG 객체 URL로 보관합니다. pdf.js는 PDF를 열 때만 동적 import합니다. CMap·표준 글꼴·WebAssembly 대체 JS는 `scripts/vitePdfjsResources.mjs` Vite 플러그인이 같은 출처의 `/pdfjs/` 아래에서 제공합니다. CSP를 바꾸지 않기 위해 `useWasm: false`로 이미지 해독에 JS 대체 모듈을 씁니다. asset URL로 열지 못하면 `read_file_binary`(최대 20 MB)로 다시 열고, 암호·손상 문서는 웹뷰 내장 뷰어(`<iframe>`)로 볼 수 있게 합니다.
- **PPTX 빠른 미리보기:** `preview/pptx/`가 `pptxtojson`으로 해석하고(큰 자료에서 화면이 멈추지 않도록 `pptxParse.worker.ts` Worker에서. Worker를 쓸 수 없으면 화면 스레드에서) `pptxSlideHtml.ts`가 슬라이드를 pt 좌표의 HTML로 만듭니다(도형은 해석 결과의 SVG 경로, 그룹 자식 좌표는 그룹 기준, 이미지 자르기는 퍼센트, 겹침은 `order` 순). 텍스트 HTML은 파일 내용에서 나오므로 스크립트를 허용하지 않는 샌드박스 iframe(`sandbox="allow-same-origin"`)에만 넣고, iframe은 포커스·마우스 입력을 받지 않게 해 화살표 키를 가로채지 않습니다. 이미지는 객체 URL 하나를 슬라이드·썸네일이 함께 쓰고 닫을 때 모두 해제합니다. Worker에서 만든 객체 URL은 Worker가 끝나면 사라지므로, Worker가 Blob을 함께 돌려주고 화면 쪽에서 URL을 다시 만듭니다(`pptxDeck.ts`). EMF·WMF·WDP 이미지와 차트·미디어는 자리 표시로 그립니다. asset URL로 읽고(20 MB 한도 없음) 실패하면 `read_file_binary`로 읽으며, 해석에 실패하면 기존 텍스트 목록(`quickPreviewRenderers/pptxRenderer.ts`)으로 대신합니다. 미리보기 핸들러는 `{ type: "pptx", src }`만 돌려주고 해석은 화면이 맡습니다.
- **XLSX 빠른 미리보기:** `read-excel-file`에 넘기기 전에 jszip으로 압축 없는 zip으로 다시 묶습니다(`xlsxRenderer.ts`의 `repackWithoutCompression`). `read-excel-file`이 쓰는 fflate는 압축을 푼 크기가 512 KB 이상인 항목을 `blob:` Web Worker에서 푸는데, CSP가 `blob:` Worker를 막고 fflate는 그 실패를 알리지 않아 미리보기가 "준비 중"에서 멈췄기 때문입니다. 이 단계를 빼거나 CSP에 `blob:` Worker를 열지 않습니다.
- **SQLite 빠른 미리보기:** `.db`, `.sqlite`, `.sqlite3`는 텍스트로 읽지 않고 Rust command `preview_sqlite_database`가 read-only로 열어 사용자 테이블/뷰의 컬럼과 제한된 샘플 행만 반환합니다. 민감 홈 경로 차단 정책은 일반 파일 미리보기와 동일하게 적용합니다.
- **Windows 터미널·명령 실행:** `system/launch/`는 작업 폴더에서 Windows 확장 경로 접두어(`\\?\`)를 뗍니다(CMD는 이 형식을 UNC 경로로 보고 거부합니다). 명령 실행은 `cd /d "..." && 명령`을 인자로 만들지 않고, `cmd.exe`를 새 콘솔(`CREATE_NEW_CONSOLE`)·`current_dir`로 띄워 명령을 `raw_arg`로 `/S /K "명령"`에 그대로 넘깁니다. Rust는 인자 안의 따옴표를 `\"`로 바꾸는데 CMD는 이를 이해하지 못해 경로가 깨졌기 때문입니다. 네트워크 공유(`\\server\share`)는 CMD가 작업 폴더로 쓰지 못하는 제한이 남아 있습니다.
- **Git 상태 표시 (`useGitStatus`):** 경로별 Git 상태를 `gitStatusStore`에 캐싱하고 패널 파일 리스트에 M/A/D/? 마킹으로 표시합니다. 이전에 실패한 경로는 `hasFreshFailure` 체크로 재시도 없이 null을 반환합니다(Windows noisy probe 억제).
- **잡 큐 이벤트 연동 (`useJobQueue`):** 앱 시작 시 진행 중/실패 잡을 복원하여 ProgressDialog를 자동 표시합니다. `job-updated` Tauri 이벤트를 구독하고, 잡 완료 시 영향 받은 디렉터리의 패널을 자동 갱신합니다. delete 잡은 삭제된 경로를 패널에서 제거한 뒤 갱신합니다.
- **디렉터리 크기 계산:** `useBackgroundDirSizes`가 디렉터리 크기를 빠르게 추정하고, 일반 로컬 경로는 백그라운드 정확 계산으로 보강합니다. CloudStorage/Windows `AppData` 같은 경로는 자동 정확 계산을 피합니다. 수동 계산은 `manualDirectorySizeScan.ts`가 진행 이벤트와 취소를 관리합니다.
- **디렉터리 크기 기준:** 모든 폴더(`.app` 포함)는 같은 스캐너로 겉보기 크기를 셉니다. 1GiB 이상이면서 실제 할당이 절반 미만인 sparse 파일만 할당 크기로 세고, 하드링크는 `(dev, ino)`로 한 번만 셉니다. 심볼릭 링크·reparse point, 루트와 장치 번호가 다른 볼륨, macOS 데이터 볼륨 firmlink(`/System/Volumes/Data`)로는 내려가지 않습니다.
- **크기 상태:** `exact`(정확), `limited`(권한이 없어 못 읽은 항목을 뺀 하한값, "≥"), `partial`(읽기 오류 등으로 미완료, "+"), `estimated`(빠른 추정, "~"; 0이면 "-")가 있습니다. 권한 오류는 `partial`이 아니라 `limited`로 취급합니다. `partial`은 재스캔 대상이라 Windows `C:\Users`에서 "+"가 풀리지 않던 문제가 있었기 때문입니다. `limited`의 TTL·재검증 규칙은 `exact`와 같습니다.
- **크기 계산 공유:** `scan_dir_size`는 진행 중인 계산을 `scan_id`가 아니라 경로 기준으로 공유합니다(`dir_size/shared_scan.rs`). 마지막 요청자가 취소해야 계산이 멈추고, 결과의 `startedAtMs`로 늦게 합류한 요청도 스캔 도중의 변경을 stale로 판단합니다. 정보 다이얼로그도 같은 경로를 씁니다.
- **병렬 크기 스캐너:** `dir_size/scan.rs`는 `sysinfo`의 rayon 전역 풀과 분리한 전용 풀(스레드 4~8개, macOS는 4~6개, 스택 8 MiB)에서 디렉터리 단위로 병렬 순회합니다. macOS는 항목을 `getattrlistbulk`로 디렉터리마다 일괄 조회하고(`dir_size/bulk_listing.rs`, `unsafe`는 이 파일에만), 일괄 조회를 지원하지 않는 디렉터리만 `read_dir`로 읽습니다. 8스레드에서는 일괄 조회가 `/System`을 오히려 느리게 읽어 macOS 상한을 6으로 둡니다. 디렉터리 핸들은 다 읽고 닫은 뒤 하위로 내려가고(열린 파일 수 한도 대비), 진행 이벤트는 작업 스레드가 아니라 호출 스레드가 200ms마다 보냅니다. 하드링크는 끝에서 한 번만 더하므로 진행값이 최종값을 넘지 않습니다. 네트워크 파일시스템 루트(macOS statfs 이름, Windows UNC)는 스캔마다 스레드 하나짜리 풀을 따로 만듭니다. Windows는 항목 크기를 목록 조회(`FindNextFileW`) 값으로 읽어 파일마다 다시 조회하지 않으므로, 쓰는 중인 파일 크기는 늦게 반영됩니다(의도된 동작).
- **하위 폴더 결과:** 정확 계산 결과의 `children`에 깊이 1~2 하위 폴더 값(큰 폴더부터 최대 2,000개)이 함께 옵니다. 각 값은 그 폴더만 따로 계산한 값과 같습니다. 프런트엔드는 `recordScannedChildSizes` → `applyScannedChildSizes` 한 경로로 크기 캐시에 넣어, 폴더에 들어가면 바로 표시하고 다시 계산하지 않습니다. 이 스캔 시작 뒤에 끝난 다른 정확 계산 값은 덮어쓰지 않고, 디스크 캐시에는 깊이 1만 최근 사용 시각을 바꾸지 않은 채 저장합니다.
- **디렉터리 크기 캐시:** Rust가 앱 데이터 폴더의 `size-cache-v1.json`에 안정적인 크기 결과를 보관하고(`size_cache.rs`, 최대 10,000개, TTL: exact·limited 7일, estimated·partial 1일), `directorySizeCachePersistence.ts`와 `usePersistentSizeCache`가 불러오고 저장합니다. 오래된 exact·limited 값은 estimated/stale 상태로 되돌려 재검증 대상으로 취급합니다.
- **크기 캐시 무효화 (3-2단계):** 파일 감시는 패널 경로뿐 아니라 패널이 떠난 최근 경로 8개까지 이어서 합니다(`panelWatch.ts`의 `updateWatchRoots`, `useDirectoryWatch`). 감시 중인 경로의 폴더 크기는 변경이 오면 stale이 되므로 "이번 세션에 확인함" 표시를 유지하고, 감시 범위에서 빠지면 표시를 지워(`expireSizeVerificationOutside`) 다시 보일 때 재검증합니다. 외부 변경으로 stale이 된 exact·limited 값은 디스크 캐시에서도 `estimated`로 낮춰, 앱을 다시 켰을 때 예전 값이 정확한 값으로 살아나지 않게 합니다.
- **Command Palette:** `Cmd/Ctrl+Shift+P`로 열고 `src/components/dialogs/palette/commandPaletteActions.ts`에서 현재 패널 상태 기반 명령 목록과 비활성 사유를 계산합니다. 실행은 `CommandPalette.tsx`에서 기존 dialog/store/Tauri facade를 호출합니다. 마지막 이름 변경/이동 Undo는 `fileOperationUndoStore.ts`에 세션 단위로 보관하고 Palette 명령에서 실행합니다.
- **현재 폴더 빠른 필터:** 각 `FilePanel`은 패널 로컬 상태로 필터 문자열을 보관하고 `quickFilter.ts` 헬퍼로 현재 폴더 파일 목록만 좁힙니다. `/` 키는 활성 패널의 필터 입력으로 포커스를 이동하며, 필터 적용 중 숨겨진 선택 항목은 안전하게 해제합니다.
- **최근 위치 / 자주 쓰는 위치:** `locationHistoryStore.ts`가 패널 경로 이동을 localStorage에 기록합니다. 즐겨찾기 패널은 최근/자주 쓰는 위치 섹션을 표시하고, Command Palette는 위치 항목을 검색 가능한 명령으로 추가합니다.
- **외부 파일 드롭:** `useExternalFileDrop`은 앱 밖에서 끌어온 파일 경로를 `FileList` 드롭 대상으로 받아 기존 복사/충돌 처리 흐름으로 넘깁니다. 내부 드래그가 진행 중이면 외부 드롭 처리를 건너뜁니다.
- **설정 영속화:** `settingsStore`는 글자 크기, 앱 글꼴, 좌측 패널 비율을 `mycommander-settings`에 저장합니다. 레거시 `uiFontFamily` / `monoFontFamily` 값은 현재 `fontFamily`로 마이그레이션합니다.
- **창 상태 복원:** Tauri `window-state` 플러그인이 창 크기/위치/최대화 상태를 복원합니다. 설정 다이얼로그의 창 크기 프리셋은 현재 창에 즉시 적용하고 이후 수동 크기 조정은 플러그인이 기억합니다.

---

## 디렉터리 구조 메모

```text
src/
  components/
    dialogs/     # 공통 다이얼로그와 파일 작업 UI
      jobs/      # ProgressDialog, JobCenterDialog, 작업 큐 표시 보조 로직
      palette/   # Command Palette UI, 검색, 실행 액션
      preview/   # Quick Preview UI, 파일 타입 판별, 문서/DB 렌더러
      search/    # 검색 옵션, 검색 실행, 결과 선택/작업 UI
      sync/      # 디렉터리 동기화 다이얼로그와 상태 보조 로직
    favorites/   # 즐겨찾기 사이드 패널
    layout/      # 상태바, 컨텍스트 메뉴, 하단 액션
    panel/       # 듀얼 패널, 파일 리스트, 주소창, 탭 바, 드라이브 목록
      drag/      # 패널/외부 드래그 드롭 규칙, 상태, 액션, 테스트
      selection/ # 파일 리스트 선택 상태 관리
      size/      # 디렉터리 크기 계산/표시 훅
      visuals/   # 파일 아이콘/색상/시각 카탈로그
  features/      # 기능 단위 로직 (multiRename, syncExecution, fileOperationJobs)
  hooks/
    tauriCommands/     # IPC 클라이언트: archiveCommands / fileCommands / gitCommands / jobCommands / searchCommands / syncCommands / systemCommands
    useFileSystem.ts   # Tauri 명령 facade (컴포넌트·훅의 단일 진입점)
    useGitStatus.ts    # 경로별 Git 상태 조회 + gitStatusStore 캐싱
    useJobQueue.ts     # 잡 큐 복원 + job-updated 이벤트 → 패널 갱신 연동
    useRendererRecovery.ts  # macOS sleep/wake 후 렌더러 고착 복구
    useAppCommands.ts  # 앱 레벨 키보드 액션 바인딩
    useAppLifecycle.ts # 앱 시작/종료 훅
    useDirectoryWatch.ts    # file_watch_commands 이벤트 구독 → 패널 갱신
    useKeyboard.ts     # 저수준 키보드 이벤트 처리
  constants/     # 앱 전역 상수 (폰트 옵션 등)
  store/         # Zustand 스토어 + 패널/설정/크기 캐시 영속화/새로고침 보조 로직
  types/         # 파일/테마/동기화 타입 정의
  utils/         # 포맷팅, 경로, 클립보드 유틸

src-tauri/src/commands/
  system/             # drives / paths / menu / launch 하위 모듈
  fs/                 # metadata / operations / archive / shared 하위 모듈
  jobs/               # state / persistence / execution / commands 하위 모듈
  git_commands.rs          # Git 상태 파싱 (git_commands/status.rs 하위 모듈)
  file_watch_commands.rs   # notify 기반 파일시스템 감시, 변경 시 패널 자동 갱신 이벤트 발송
  search_commands.rs       # 파일 검색
  sync_commands.rs         # 디렉터리 비교
  drag_commands.rs         # 네이티브 드래그 시작
```

- `src-tauri/src/lib.rs` — Tauri 앱 빌더, 메뉴, `invoke_handler` 등록
- `src-tauri/capabilities/` + `src-tauri/permissions/` — Tauri capability/permission 관리
- `scripts/verify-tauri-command-alignment.cjs` — Rust `invoke_handler`, permission 파일, capability 포함 여부 정합성 검증

---

## 참고 메모

- 작업 방식, 검증 규칙, 커밋 메시지 규칙은 `AGENTS.md` 기준으로 유지합니다.
- 온보딩/실행/사용자 관점 설명은 `README.md`에서 다룹니다.
- Tauri v2 기준으로만 해석해야 합니다.
