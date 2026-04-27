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
듀얼 패널 탐색, 탭과 히스토리, 즐겨찾기, 검색, 빠른 미리보기, 일괄 이름 변경, ZIP 작업, 폴더 비교/동기화, 패널 간 드래그 드롭 복사 UX를 포함합니다.

앱의 기본 화면 구성 요소: 좌측 즐겨찾기 패널, 좌/우 듀얼 파일 패널, 상태바 및 하단 액션 바, 다이얼로그 기반 파일 작업 UI.

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
| Desktop Shell | Tauri v2 |
| Backend | Rust, Tauri custom commands |
| UI | Radix UI Dialog, Lucide React, `react-resizable-panels` |
| Virtualized List | `@tanstack/react-virtual` |
| Preview Helpers | `highlight.js`, `marked`, `xlsx`, `jszip` |
| Utilities | `date-fns`, `clsx`, `tailwind-merge` |
| Testing | Vitest, Testing Library |

---

## 프런트엔드 구조 메모

### 비명시적 동작 (코드만으로 파악하기 어려운 것)

- **자동 테마:** 07:00–19:00는 light, 그 외는 dark. 창 포커스 시 재평가.
- **토스트 피드백:** 짧은 성공/경고/오류는 `StatusBar` 인라인이 아닌 `toastStore` + `ToastViewport`로 표시. 긴 작업은 `ProgressDialog`, 이력은 `JobCenterDialog`.
- **패널 갱신:** 파일 생성/삭제/이름 변경/복사/이동 후 같은 디렉터리를 보고 있는 다른 패널도 함께 갱신. `panelRefresh`는 Zustand 덮어쓰기 방지를 위해 단일 `updatePanelTabs`로 일괄 처리.
- **더블클릭 진입:** 일반 디렉터리든 symlink든 실제 경로 접근 가능 여부를 먼저 확인 후 표시 경로로 상태를 갱신.
- **확장 트리 메타데이터:** `FileList.tsx`의 확장된 하위 폴더 항목 정보는 전역 상태가 아닌 DOM 속성(`data-entry-*`)에 저장. 컨텍스트 메뉴 등에서 하위 항목 처리 시 DOM에서 재구성 필요.
- **`panelStore` 경로 이중 구조:** `currentPath`(UI/히스토리 표시용) / `resolvedPath`(실제 파일시스템 접근용). 경로 비교·접근은 `resolvedPath ?? currentPath` 패턴 우선.
- **프런트엔드 Tauri IPC 경계:** 프런트엔드의 직접 `invoke()` 호출은 `src/hooks/tauriCommands/` 하위 명령 클라이언트에만 둡니다. 컴포넌트와 일반 훅은 `useFileSystem()` facade를 통해 Tauri 명령을 호출합니다.
- **탭-패널 상태 동기화:** 활성 탭 상태를 패널 상단 상태로 반영하는 계약은 `src/utils/panelHelpers.ts`의 `syncPanelWithActiveTab`이 담당합니다. `panelRefresh` 같은 갱신 경로에서 별도 동기화 복사본을 만들지 않습니다.

---

## 디렉터리 구조 메모

```text
src/
  components/
    dialogs/     # 복사/이동/검색/미리보기/동기화/일괄이름변경 UI + preview/dialog helper modules
    favorites/   # 즐겨찾기 사이드 패널
    layout/      # 상태바, 컨텍스트 메뉴, 하단 액션
    panel/       # 듀얼 패널, 파일 리스트, 주소창, 탭 바, 드라이브 목록 + drag helper modules
  features/      # 기능 단위 로직 (예: multiRename)
  hooks/         # Tauri 명령 facade, tauriCommands 하위 명령 클라이언트, 키보드 훅
  constants/     # 앱 전역 상수 (폰트 옵션 등)
  store/         # Zustand 스토어 + 패널 영속화/새로고침 보조 로직
  types/         # 파일/테마/동기화 타입 정의
  utils/         # 포맷팅, 경로, 클립보드 유틸

src-tauri/src/commands/
  system/             # drives / paths / menu / launch 하위 모듈
  fs/                 # metadata / operations / archive / shared 하위 모듈
  jobs/               # state / persistence / execution / commands 하위 모듈
  file_watch_commands.rs  # notify 기반 파일시스템 감시, 변경 시 패널 자동 갱신 이벤트 발송
  search_commands.rs      # 파일 검색
  sync_commands.rs        # 디렉터리 비교
  drag_commands.rs        # 네이티브 드래그 시작
```

- `src-tauri/src/lib.rs` — Tauri 앱 빌더, 메뉴, `invoke_handler` 등록
- `src-tauri/capabilities/` + `src-tauri/permissions/` — Tauri capability/permission 관리

---

## 참고 메모

- 작업 방식, 검증 규칙, 커밋 메시지 규칙은 `AGENTS.md` 기준으로 유지합니다.
- 온보딩/실행/사용자 관점 설명은 `README.md`에서 다룹니다.
- Tauri v2 기준으로만 해석해야 합니다.
