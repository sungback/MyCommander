# MyCommander — CLAUDE.md

이 파일은 MyCommander 프로젝트의 현재 구현 상태를 빠르게 파악하기 위한 컨텍스트 문서입니다.
작업 절차, 검증 규칙, 커밋/빌드 위생은 [`AGENTS.md`](./AGENTS.md)를 우선 따릅니다.

---

## 프로젝트 개요

**MyCommander**는 **Tauri v2 + React 19 + TypeScript** 기반의 크로스플랫폼 데스크톱 파일 매니저입니다.
현재 구현은 단순 파일 브라우저를 넘어, **듀얼 패널 탐색**, **탭과 히스토리**, **즐겨찾기**, **검색**, **빠른 미리보기**, **일괄 이름 변경**, **ZIP 작업**, **폴더 비교/동기화 보조 기능**, **패널 간 드래그 드롭 복사 UX**까지 포함합니다.

빠른 미리보기는 이미지/비디오/PDF뿐 아니라 R script, Markdown, HTML, Excel, PowerPoint, HWPX, DOCX, Jupyter Notebook 같은 문서 계열도 대응합니다.

앱의 기본 화면은 다음 요소들로 구성됩니다.

- 좌측 즐겨찾기 패널
- 좌/우 듀얼 파일 패널
- 상태바 및 하단 액션 바
- 다이얼로그 기반 파일 작업 UI

---

## 현재 구현된 주요 기능

### 파일 탐색 / 패널

- 좌/우 **듀얼 패널** 구조
- 패널별 **탭** 추가/전환/닫기
- 패널별 **경로 히스토리**와 뒤로/앞으로 이동
- 활성 패널 전환 (`Tab`)
- 상세 / 간단 보기 모드 전환
- 숨김 파일 표시 토글
- 이름 / 크기 / 날짜 기준 정렬
- 경로 breadcrumb 이동
- 드라이브 목록 표시

### 파일 작업

- 새 폴더 생성
- 새 파일 생성
  - 새 파일 다이얼로그 기본 입력값은 빈 칸으로 유지
  - `New File.txt` 같은 기본 파일명 프리필은 사용하지 않음
- 이름 변경
- 삭제
- 복사 / 이동
- 복사 충돌 확인
- 패널 간 드래그 드롭 복사
- 이름 충돌이 없을 때 즉시 복사, 충돌 시 확인 다이얼로그
- ZIP 생성 / ZIP 압축 해제
- 파일 열기, 에디터로 열기, 터미널에서 열기
- 현재 폴더 기준 셸 명령 실행
- 한글 파일명 생성 시 현재 동작은 NFC 보존 기준으로 유지해야 함
  - 새 파일/폴더 이름을 생성할 때 NFD로 강제 정규화하지 않음
  - 이 동작은 Windows로 복사할 때 한글 이름이 분해되어 보이지 않도록 유지하는 정책임

### 생산성 기능

- 빠른 미리보기 (`F3`)
- 검색 다이얼로그 및 검색 결과 일괄 작업
- 다중 파일 일괄 이름 변경
- 폴더 비교 기반 동기화 다이얼로그
- 같은 폴더를 보고 있는 양쪽 패널의 자동 갱신
- 선택 항목 / 용량 / 여유 공간 상태 표시
- 즐겨찾기 추가 / 이름 변경 / 재정렬 / 접기

### 데스크톱 통합

- Tauri 앱 메뉴
- 컨텍스트 메뉴
- 테마 선택 (`auto`, `light`, `dark`)
- 패널별 보기 모드 메뉴 연동
- 메뉴 이벤트와 프런트엔드 상태 동기화
- 네이티브 드래그 연동 및 패널 간 드롭 처리

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

## 디렉터리 구조

```text
MyCommander/
├── src/
│   ├── components/
│   │   ├── dialogs/         # 복사/이동/검색/미리보기/동기화/일괄이름변경 UI
│   │   ├── favorites/       # 즐겨찾기 사이드 패널
│   │   ├── layout/          # 상태바, 컨텍스트 메뉴, 하단 액션 정의
│   │   └── panel/           # 듀얼 패널, 파일 리스트, 주소창, 탭 바, 드라이브 목록
│   ├── features/            # 기능 단위 로직 (예: multiRename)
│   ├── hooks/               # Tauri 명령 래퍼 및 키보드 훅
│   ├── store/               # Zustand 스토어 + 패널 갱신 보조 로직
│   ├── test/                # 테스트 유틸 / mock
│   ├── types/               # 파일/테마/동기화 타입 정의
│   ├── utils/               # 포맷팅, 경로, 클립보드 유틸
│   ├── App.tsx              # 앱 루트 구성과 전역 이벤트 연결
│   └── main.tsx             # React 진입점
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── system_commands.rs
│   │   │   ├── fs_commands.rs
│   │   │   ├── search_commands.rs
│   │   │   ├── sync_commands.rs
│   │   │   └── drag_commands.rs
│   │   ├── lib.rs           # Tauri 앱 빌더, 메뉴, invoke_handler 등록
│   │   └── main.rs          # Tauri 진입점
│   ├── capabilities/        # Capability 정의
│   ├── permissions/         # Tauri 명령 권한 설정
│   ├── tauri.conf.json      # 앱 설정, 번들 설정, dev/build 연결
│   └── Cargo.toml
├── public/
├── README.md
├── AGENTS.md
├── package.json
└── version-sync.cjs
```

---

## 프런트엔드 구조 메모

### 앱 구성

- `src/App.tsx`는 앱 뼈대를 조립합니다.
  - `FavoritesPanel`
  - `DualPanel`
  - `StatusBar`
  - `DialogContainer`
  - `MultiRenameDialog`
  - `SearchPreviewDialogs`
  - `SyncDialog`
  - `ContextMenu`

### 상태 관리

- `panelStore`
  - 좌/우 패널 상태
  - 패널별 탭, 경로, 히스토리, 선택, 커서, 정렬, 보기 모드
  - `currentPath`는 UI/히스토리에 보이는 경로, `resolvedPath`는 실제 파일 시스템 접근 경로로 사용
  - 숨김 파일 표시 여부
  - 테마 선호도
  - 드래그 상태
- `dialogStore`
  - 현재 열린 다이얼로그
  - 다이얼로그 대상 파일/폴더
  - 드래그 복사 요청 상태
  - 일괄 이름 변경 세션
- `panelRefresh`
  - 변경된 디렉터리를 보고 있는 패널만 선택적으로 새로고침
- `uiStore`
  - 상태 메시지
  - 즐겨찾기 패널 열림/닫힘
- `favoriteStore`
  - 즐겨찾기 목록, 순서, 이름 변경

### UI/상호작용

- `FileList.tsx`는 가상 스크롤과 키보드/드래그 상호작용의 핵심입니다.
- `AddressBar.tsx`는 breadcrumb, 홈 이동, 새로고침, 경로 복사, 반대 패널 동기화를 담당합니다.
- `StatusBar.tsx`는 패널 요약, 여유 공간, 현재 경로 명령 실행 입력창, 하단 액션 버튼을 제공합니다.
- 파일 생성/삭제/이름 변경/복사/이동 후에는 같은 디렉터리를 보고 있는 다른 패널도 함께 갱신됩니다.
- macOS CloudStorage 계열 symlink 경로(예: `~/Dropbox`)는 표시 경로를 유지하면서, 실제 접근은 `resolvedPath` 기준으로 처리합니다.
- 따라서 폴더 로드, 패널 감시, 새로고침, 반대 패널 동기화, 상태바 여유 공간 계산 같은 경로 비교/접근 지점은 `resolvedPath ?? currentPath` 패턴을 우선 사용합니다.
- 더블클릭 진입은 디렉터리 항목이 일반 디렉터리로 보이든 symlink로 보이든 먼저 실제 경로 접근 가능 여부를 확인한 뒤 표시 경로로 진입 상태를 갱신합니다.
- 일부 UI 상태는 `localStorage`에 저장됩니다.
  - 패널 상태
  - 즐겨찾기

---

## 백엔드 구조 메모

### Tauri 명령 모듈

- `system_commands.rs`
  - 드라이브 조회
  - 홈 디렉터리 조회
  - 여유 공간 조회
  - 파일/에디터/터미널 열기
  - 셸 명령 실행
  - 앱 종료
  - 메뉴 상태 반영
  - 컨텍스트 메뉴 표시
- `fs_commands.rs`
  - 디렉터리 목록 조회
  - 파일/폴더 생성
  - 삭제 / 이름 변경 / 복사 / 이동
  - ZIP 생성 / 압축 해제
  - 파일 내용 읽기
  - 폴더 용량 계산
  - 복사 충돌 점검
  - `keep_both` 기반 자동 copy 이름 생성
- `search_commands.rs`
  - 파일 검색
- `sync_commands.rs`
  - 디렉터리 비교
- `drag_commands.rs`
  - 네이티브 드래그 시작

### 메뉴 / 권한

- `src-tauri/src/lib.rs`에서 앱 메뉴와 `invoke_handler`를 함께 구성합니다.
- 메뉴는 파일 / 보기 / 테마 / 명령 관련 액션을 포함합니다.
- Tauri capability/permission은 `src-tauri/capabilities/` 및 `src-tauri/permissions/`에서 관리합니다.

---

## 주요 개발 명령어

```bash
# 앱 개발 실행
npm run tauri dev

# 프런트엔드만 실행
npm run dev

# 프런트엔드 빌드
npm run build

# TypeScript 타입 체크
./node_modules/.bin/tsc --noEmit

# 프런트엔드 테스트
npm run test

# Rust 테스트
npm run test:rust

# Rust 체크
cargo check --manifest-path src-tauri/Cargo.toml
```

개발 서버 URL은 일반적으로 `http://127.0.0.1:1420` 입니다.

---

## 참고 메모

- 이 문서는 현재 프로젝트 구조와 기능을 설명하기 위한 컨텍스트 문서입니다.
- 작업 방식, 검증 규칙, 커밋 메시지 규칙은 `AGENTS.md` 기준으로 유지합니다.
- 온보딩/실행/사용자 관점 설명은 `README.md`에서 다룹니다.
- Tauri v2 기준으로만 해석해야 합니다.
