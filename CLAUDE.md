# MyCommander — CLAUDE.md

이 파일은 Claude가 이 프로젝트를 이해하고 작업할 때 참고하는 컨텍스트 문서입니다.

---

## 프로젝트 개요

**MyCommander**는 Tauri v2 + React 19 + TypeScript로 만든 크로스플랫폼 데스크톱 파일 매니저입니다.  
듀얼 패널 방식의 파일 탐색 UI를 목표로 개발 중입니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Desktop Shell | Tauri v2 |
| Backend (Rust) | Tauri 커스텀 커맨드, Tauri 플러그인 |
| 상태 관리 | Zustand |
| UI 컴포넌트 | Radix UI (Dialog), Lucide React (아이콘) |
| 가상 스크롤 | @tanstack/react-virtual |
| 날짜 | date-fns |

---

## 디렉토리 구조

```
MyCommander/
├── src/                      # React 프런트엔드
│   ├── components/           # UI 컴포넌트
│   ├── hooks/                # 커스텀 훅
│   ├── store/                # Zustand 스토어
│   ├── types/                # TypeScript 타입 정의
│   ├── utils/                # 유틸리티 함수
│   ├── App.tsx               # 최상위 컴포넌트
│   └── main.tsx              # 진입점
├── src-tauri/                # Rust 백엔드 (Tauri)
│   ├── src/
│   │   ├── commands/         # Tauri 커스텀 커맨드
│   │   ├── lib.rs            # 앱 빌더 및 커맨드 등록
│   │   └── main.rs           # 진입점
│   ├── permissions/          # Tauri 권한 설정
│   ├── Cargo.toml
│   └── tauri.conf.json       # Tauri 앱 설정
├── public/                   # 정적 파일
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 주요 개발 명령어

```bash
# Tauri 데스크톱 앱 실행 (개발)
npm run tauri dev

# 프런트엔드만 실행
npm run dev

# 프런트엔드 빌드
npm run build

# TypeScript 타입 체크
./node_modules/.bin/tsc --noEmit

# Rust 체크
cargo check --manifest-path src-tauri/Cargo.toml

# 배포 빌드 (설치 파일 생성)
npm run tauri build
```

개발 서버: `http://127.0.0.1:1420`  
포트 충돌 시: `lsof -ti tcp:1420 | xargs kill`

---

## 코드 작성 규칙

### Frontend (TypeScript / React)

- 컴포넌트는 `src/components/` 아래에 기능별로 분리
- 전역 상태는 Zustand (`src/store/`) 사용
- 타입 정의는 `src/types/`에 모음
- 유틸 함수는 `src/utils/`에 모음
- 스타일은 Tailwind CSS v4 사용 (인라인 클래스 방식)
- 아이콘은 `lucide-react` 사용
- 긴 목록은 `@tanstack/react-virtual`로 가상화

### Backend (Rust / Tauri)

- Tauri 커스텀 커맨드는 `src-tauri/src/commands/`에 추가
- 커맨드 추가 후 `lib.rs`의 `invoke_handler`에 등록 필요
- 권한은 `src-tauri/permissions/`에서 관리
- `tauri.conf.json`에서 앱 설정 및 번들 타겟 관리

### 공통

- 커밋 메시지는 영어로 작성 (예: `Fix file delete error on Windows`)
- 빌드 산출물(`dist/`, `src-tauri/target/`)은 커밋하지 않음

---

## 주의 사항

- **`src-tauri/target/`** 는 수 GB까지 커질 수 있음. 용량 정리 시 `cargo clean --manifest-path src-tauri/Cargo.toml` 사용
- **Tauri v2** 기준으로 작성됨. v1과 API가 다를 수 있으니 공식 문서 확인 필요
- **권한 오류** 발생 시 `src-tauri/permissions/` 설정과 `tauri.conf.json`의 `security.capabilities` 확인
- 빌드 오류 시 `build_log.txt` 참고 (루트에 위치)
- `.omc/`, `.omx/` 는 앱 내부 설정/캐시 폴더로 직접 편집 불필요

---

## 플랫폼별 배포 빌드

```bash
# macOS (.dmg / .app)
npm run tauri build -- --bundles dmg

# Windows (.exe NSIS)
npm run tauri build -- --bundles nsis

# Linux (.deb / .AppImage)
npm run tauri build -- --bundles deb,appimage
```

산출물 경로: `src-tauri/target/release/bundle/`
