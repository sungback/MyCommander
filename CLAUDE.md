# MyCommander — CLAUDE.md

이 파일은 MyCommander 프로젝트의 현재 구현 상태를 빠르게 파악하기 위한 컨텍스트 문서입니다.
작업 절차, 검증 규칙, 커밋/빌드 위생은 [`AGENTS.md`](./AGENTS.md)를 우선 따릅니다.

---

## 에이전트 행동 원칙

- **행동 전 먼저 생각할 것.** 코드를 작성하기 전에 기존 파일을 먼저 읽는다.
- **출력은 간결하게, 추론은 철저하게.** 결과물은 핵심만 전달하되 논리적 근거는 상세히 갖춘다.
- **전체 재작성보다 부분 수정을 선호할 것.** 필요한 부분만 Edit 도구로 수정한다.
- **변경 사항이 없는 한 이미 읽은 파일을 다시 읽지 말 것.**
- **100KB 이상의 파일은 건너뛸 것.** 명시적인 요청이 없다면 대용량 파일은 제외한다.
- **세션이 길어지면 `/cost` 실행을 제안할 것.** 캐시 효율(Cache Ratio)을 모니터링할 수 있도록 안내한다.
- **관련 없는 작업으로 전환 시 새 세션을 권장할 것.** 컨텍스트 혼선을 막기 위해 새 대화를 시작하도록 유도한다.
- **완료 선언 전 반드시 코드를 테스트할 것.**
- **아첨하는 도입부나 의미 없는 맺음말 금지.**
- **해결책은 단순하고 직관적으로 유지할 것.**
- **사용자의 지침은 항상 이 설정보다 우선함.**

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

`src/App.tsx`는 앱 뼈대를 조립합니다: `FavoritesPanel`, `DualPanel`, `StatusBar`, `DialogContainer`, `MultiRenameDialog`, `SearchPreviewDialogs`, `SyncDialog`, `ContextMenu`.

### 상태 관리

- `panelStore` — 좌/우 패널 상태, 탭·경로·히스토리·선택·커서·정렬·보기 모드, 숨김 파일 표시, 테마 선호도, 드래그 상태
  - `currentPath`: UI/히스토리에 보이는 경로
  - `resolvedPath`: 실제 파일 시스템 접근 경로
- `dialogStore` — 현재 열린 다이얼로그, 대상 파일/폴더, 드래그 복사 요청 상태, 일괄 이름 변경 세션
- `panelRefresh` — 변경된 디렉터리를 보고 있는 패널만 선택적으로 새로고침
- `uiStore` — 상태 메시지, 즐겨찾기 패널 열림/닫힘
- `favoriteStore` — 즐겨찾기 목록, 순서, 이름 변경

`localStorage` 저장 항목: 패널 상태, 즐겨찾기, 테마 선호도.

### 핵심 컴포넌트

- `FileList.tsx` — 가상 스크롤, 키보드/드래그 상호작용의 핵심
- `AddressBar.tsx` — breadcrumb, 홈 이동, 새로고침, 경로 복사, 반대 패널 동기화
- `StatusBar.tsx` — 패널 요약, 여유 공간, 명령 실행 입력창, 하단 액션 버튼

파일 생성/삭제/이름 변경/복사/이동 후에는 같은 디렉터리를 보고 있는 다른 패널도 함께 갱신됩니다.

더블클릭 진입은 디렉터리가 일반 디렉터리든 symlink든 먼저 실제 경로 접근 가능 여부를 확인한 뒤 표시 경로로 진입 상태를 갱신합니다.

---

## 디렉터리 구조 메모

```text
src/
  components/
    dialogs/     # 복사/이동/검색/미리보기/동기화/일괄이름변경 UI
    favorites/   # 즐겨찾기 사이드 패널
    layout/      # 상태바, 컨텍스트 메뉴, 하단 액션
    panel/       # 듀얼 패널, 파일 리스트, 주소창, 탭 바, 드라이브 목록
  features/      # 기능 단위 로직 (예: multiRename)
  hooks/         # Tauri 명령 래퍼 및 키보드 훅
  store/         # Zustand 스토어 + 패널 갱신 보조 로직
  types/         # 파일/테마/동기화 타입 정의
  utils/         # 포맷팅, 경로, 클립보드 유틸

src-tauri/src/commands/
  system_commands.rs  # 드라이브·홈·여유공간, 파일/에디터/터미널 열기, 셸 실행, 메뉴
  fs_commands.rs      # 디렉터리 목록, 파일/폴더 CRUD, ZIP, 충돌 점검, keep_both 이름 생성
  search_commands.rs  # 파일 검색
  sync_commands.rs    # 디렉터리 비교
  drag_commands.rs    # 네이티브 드래그 시작
```

- `src-tauri/src/lib.rs` — Tauri 앱 빌더, 메뉴, `invoke_handler` 등록
- `src-tauri/capabilities/` + `src-tauri/permissions/` — Tauri capability/permission 관리

---

## 참고 메모

- 작업 방식, 검증 규칙, 커밋 메시지 규칙은 `AGENTS.md` 기준으로 유지합니다.
- 온보딩/실행/사용자 관점 설명은 `README.md`에서 다룹니다.
- Tauri v2 기준으로만 해석해야 합니다.
