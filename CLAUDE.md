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

### 앱 구성

`src/App.tsx`는 앱 뼈대를 조립합니다: `FavoritesPanel`, `DualPanel`, `StatusBar`, `DialogContainer`, `ProgressDialog`, `JobCenterDialog`, `MultiRenameDialog`, `SearchPreviewDialogs`, `SyncDialog`, `ContextMenu`, `ToastViewport`.

자동 테마(auto): 07:00–19:00는 light, 그 외는 dark로 자동 전환되며 창 포커스 시 재평가합니다.

### 상태 관리

- `panelStore` — 좌/우 패널 상태, 탭·경로·히스토리·선택·커서·정렬·보기 모드, 숨김 파일 표시, 테마 선호도, 드래그 상태
  - `currentPath`: UI/히스토리에 보이는 경로
  - `resolvedPath`: 실제 파일 시스템 접근 경로
- `clipboardStore` — copy/cut 클립보드 상태
- `dragStore` — 패널 간/패널 내부 드래그 상태
- `dialogStore` — 현재 열린 다이얼로그, 대상 파일/폴더, 드래그 복사 요청 상태, 일괄 이름 변경 세션
- `panelRefresh` — 변경된 디렉터리를 보고 있는 패널만 선택적으로 새로고침 (Zustand 상태 덮어쓰기 방지를 위해 단일 `updatePanelTabs`로 일괄 처리)
- `persistence` — 패널 상태 localStorage 직렬화/복원
- `panelHelpers` — `panelStore`가 사용하는 탭/정렬/영속화 보조 로직
- `uiStore` — 즐겨찾기 패널 열림/닫힘
- `toastStore` — 짧은 피드백 메시지용 토스트 큐
- `favoriteStore` — 즐겨찾기 목록, 순서, 이름 변경
- `jobStore` / `useJobQueue` — Unified Job Engine: copy/move/delete/zip 작업을 큐로 관리. submit/list/cancel/retry/clear-finished 지원, 앱 재시작 시 큐 복원
- `settingsStore` — 앱 설정 영속화 (localStorage): 폰트 패밀리, 폰트 크기, 행 높이 등 UI 표시 설정
- `contextMenuStore` — 컨텍스트 메뉴 열림 상태 및 대상 항목
- `panelWatch` — 파일시스템 감시 경로 등록/해제 보조 로직

`localStorage` 저장 항목: 패널 상태, 즐겨찾기, 테마 선호도.

### 핵심 컴포넌트

- `FileList.tsx` — 가상 스크롤, 키보드/드래그 상호작용의 핵심
  - 전역 상태 비대화를 막기 위해, 확장된 하위 트리 폴더 항목의 메타데이터는 전역 상태가 아닌 DOM 속성(`data-entry-*`)에 저장되어 컨텍스트 메뉴 등에 제공됩니다.
  - `useFileListDrag.ts` — drag DOM 이벤트 오케스트레이션
  - `fileListDragSharedState.ts` — 패널 간 drag 공유 상태
  - `fileListDragRules.ts` — drop 허용/차단 규칙과 경로 판정
- `FilePanel.tsx` — 단일 패널(주소창 + 탭 바 + 파일 리스트 + 드라이브 목록) 조합
- `AddressBar.tsx` — breadcrumb, 홈 이동, 새로고침, 경로 복사, 반대 패널 동기화
- `StatusBar.tsx` — 패널 요약, 여유 공간, 명령 실행 입력창, 하단 액션 버튼
- `ToastViewport.tsx` — 짧은 성공/경고/오류 피드백을 표시하는 토스트 레이어
- `DialogContainer.tsx` — 다이얼로그 조립과 제출 진입점
  - `dialogTargetPath.ts` — 선택 항목/대상 경로 계산
  - `useDialogInfo.ts` — info 다이얼로그 크기 로딩
  - `useCopyMoveFlow.ts` — copy/move/overwrite/paste 흐름
- `ProgressDialog.tsx` — 진행 중인 작업 목록 빠른 보기, 완료 작업만 남으면 자동 닫힘
- `JobCenterDialog.tsx` — 전체 작업 이력 다이얼로그, 필터/정렬/상세 패널 포함
- `SearchPreviewDialogs.tsx` — 검색 다이얼로그와 검색 결과 후속 작업 UI
  - `searchOptions.ts` — 고급 검색 옵션 기본값/직렬화 helper
- `SettingsDialog.tsx` — 폰트, 폰트 크기, 행 높이 설정 다이얼로그
- `QuickPreviewDialog.tsx` — F3 단축키 기반 파일 빠른 미리보기
  - `quickPreviewLoader.ts` — 확장자 판별과 preview dispatcher
  - `quickPreviewRenderers/` — markdown / notebook / pptx / hwpx / xlsx / text highlight renderer

파일 생성/삭제/이름 변경/복사/이동 후에는 같은 디렉터리를 보고 있는 다른 패널도 함께 갱신됩니다.

짧은 피드백 메시지는 더 이상 `StatusBar` 오른쪽에 인라인으로 표시하지 않고, `toastStore` + `ToastViewport`를 통해 토스트로 표시합니다. 오래 걸리는 작업은 `ProgressDialog`, 작업 이력은 `JobCenterDialog`가 담당합니다.

더블클릭 진입은 디렉터리가 일반 디렉터리든 symlink든 먼저 실제 경로 접근 가능 여부를 확인한 뒤 표시 경로로 진입 상태를 갱신합니다.

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
  hooks/         # Tauri 명령 래퍼 및 키보드 훅
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
