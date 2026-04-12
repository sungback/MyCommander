# MyCommander 🚀

MyCommander는 Tauri + React + TypeScript로 만들어진 초고속 데스크톱 파일 매니저입니다.

## 🛠 기술 스택

- **Frontend**: React 19, TypeScript, Vite, Zustand
- **Desktop Shell**: Tauri v2
- **Backend**: Rust

## ⚙️ 요구 환경

- Node.js 20+ 및 npm
- Rust Stable Toolchain
- **OS별 빌드 도구**: macOS(Xcode CLI Tool), Windows(Visual Studio C++ Build Tools), Linux(WebKitGTK 등)

## 📦 빠른 시작 (Quick Start)

**1. 패키지 설치 및 Rust 빌드 점검**

```bash
npm install
cd src-tauri && cargo check && cd ..
```

**2. 앱 실행**

```bash
# 개발 모드 (UI + 프론트엔드 변경사항 실시간 반영)
npm run tauri dev
```

## ⌨️ 명령어 요약 (Commands)

| 용도 | 명령어 | 비고 |
|---|---|---|
| 앱 전체 개발 모드 | `npm run tauri dev` | 프론트엔드(포트 `1420`)와 백엔드를 동시 시작 |
| 프론트엔드만 실행 | `npm run dev` | UI 디자인 껍데기만 수정하고 싶을 때 유용함 |
| 타입스크립트 검사 | `npm run typecheck` | (또는 `./node_modules/.bin/tsc --noEmit`) |
| 백엔드 문법 검사 | `cargo check` | 반드시 `src-tauri` 폴더 안에 들어가서 실행 필요 |
| 설치 파일 패키징 | `npm run tauri build` | 윈도우, 맥, 리눅스에 맞는 앱 최종 배포 파일 생성 |

## 🏗 설치 파일 생성 (빌드)

`src-tauri/tauri.conf.json`의 번들 타겟이 `"all"`로 설정되어 있어 아래 명령어 한 줄이면 설치 파일이 생성됩니다.

```bash
npm run tauri build
```

운영체제별 주요 최종 산출물 경로는 다음과 같습니다 (`src-tauri/target/release/bundle/`의 내부 폴더):

- **macOS**: `dmg/*.dmg`, `macos/*.app`
- **Windows**: `nsis/*.exe`, `msi/*.msi`
- **Linux**: `deb/*.deb`, `appimage/*.AppImage`

> **Tip:** 특정 파일 포맷 하나만 뽑고 싶다면, `-- --bundles dmg`, `-- --bundles appimage` 등 뒤에 옵션 태그를 붙이시면 됩니다.

## 🤝 코드 기여 워크플로우 (Git)

협업이나 로컬 코드 관리를 위한 가장 기본적이고 안전한 작업 순서 요약입니다.

```bash
git pull                   # 1. 작업 전 저장소 최신 변경사항 동기화
git add -A                 # 2. 이번에 내가 수정한 파일 모두 담기
git commit -m "수정 내용"   # 3. 무엇을 바꿨는지 작업 일지(메세지) 남기기
git push                   # 4. 깃허브 원격 저장소에 최종 제출하기
```

*(기본적으로 `node_modules`, `dist`, `src-tauri/target` 등의 덩치가 큰 빌드 부산물은 Git에 제출되지 않도록 자동 보호(`.gitignore`)되어 있습니다.)*

## 🔖 버전 업데이트 (Release)

Tauri 프로젝트라면 아래 순서로 진행하는 것이 가장 안전하고 확실합니다.

### ✅ 해결된 추천 명령어

**방법 A: 수동으로 수정 후 한 번에 올리기 (가장 권장)**

1. `package.json`과 `src-tauri/tauri.conf.json`의 `version`을 모두 `0.9.0`으로 직접 수정합니다.
2. 이후 아래 명령을 실행합니다.

```bash
git add -A
git commit -m "Release v0.9.0"
git tag v0.9.0
git push origin main --tags
```

**방법 B: 자동 수정 (고급 권장 방식)**

프로젝트 루트에 설정된 자동화 스크립트를 활용해 명령어 한 줄로 모든 과정을 끝냅니다.

```bash
npm version [새로운_버전]
# 예: npm version 0.9.0
```

**상세 설명:**
- **`npm version`**: 이 명령을 실행하면 자동으로 `version-sync.cjs`가 구동되어 `tauri.conf.json`의 버전을 프론트엔드와 일치시킵니다.
- **자동 커밋 및 태그**: 버전 변경 사항이 하나의 커밋으로 자동 생성되고, `v0.9.0`과 같은 Git 태그도 자동으로 붙습니다.
- **자동 푸시**: `postversion` 훅이 트리거되어 GitHub 원격 저장소와 태그 정보가 즉시 업로드됩니다.

**공통 상세 설명:**
- **코드 수정**: Tauri 앱은 프론트엔드(`package.json`)와 백엔드 설정(`tauri.conf.json`)의 버전이 일치해야 문제없이 배포됩니다.
- **`git tag`**: 특정 시점에 이름을 붙여 보관하는 기능입니다. GitHub Action이 이 태그를 감지해 자동으로 릴리스 빌드를 시작하게 됩니다.
- **`--tags`**: 로컬에서 만든 태그를 원격 저장소(`origin`)로 함께 전송합니다.

## 🚑 문제 해결 (Troubleshooting)

### 하드디스크 빌드 용량 폭발 방지 (추천)

Tauri 개발을 오래 진행하다보면 `src-tauri/target/` 폴더 내 백엔드 컴파일 캐시 파일들이 **수십 GB** 넘게 엄청나게 쌓일 수 있습니다. 저장 공간 확보를 위해 가끔씩 쓰레기 파일들을 싹 지워주세요.

```bash
cd src-tauri && cargo clean
```

*(※ 비워내고 난 후, 다음 번에 처음 다시 `npm run tauri dev` 명령어를 입력할 때는 기초 설정들을 다시 받느라 5~10분 가량 오래 걸릴 수 있습니다.)*

### 기타 런타임 오류

- **포트 1420 충돌 오류 (Port 1420 is already in use)**: `lsof -ti tcp:1420 | xargs kill` 명령어로 앱을 억지로 쥐고 있는 뒷면의 유령 프로세스를 강제 종료 후 재실행.
- **esbuild 플랫폼 충돌 에러**: 터미널에 `npm rebuild esbuild`를 입력하여 해결. 정 안 될 시, `node_modules` 폴더 삭제 후 다시 처음부터 `npm install`.
