# MyCommander

MyCommander는 Tauri + React + TypeScript로 만든 데스크톱 파일 매니저입니다.

## 기술 스택

- Frontend: React 19, TypeScript, Vite
- Desktop shell: Tauri v2
- Backend: Rust
- State: Zustand

## 개발 환경 요구 사항

기본 요구 사항:

- Node.js 20 이상 권장
- npm
- Rust stable toolchain
- 각 운영체제별 Tauri 빌드 도구

운영체제별 준비 사항:

- macOS: Xcode Command Line Tools
- Windows: Visual Studio C++ Build Tools
- Linux: Tauri 빌드에 필요한 시스템 패키지(WebKitGTK 등)

가장 안전한 방식은 각 운영체제의 설치 파일을 해당 운영체제에서 직접 빌드하는 것입니다.

## 설치

프로젝트 루트에서 의존성을 설치합니다.

```bash
npm install
```

Rust 의존성 체크:

```bash
cd src-tauri
cargo check
cd ..
```

## 앱 실행

프런트엔드만 실행:

```bash
npm run dev
```

Tauri 데스크톱 앱 실행:

```bash
npm run tauri dev
```

참고:

- Tauri 개발 실행은 내부적으로 `npm run dev`를 먼저 띄운 뒤 앱을 실행합니다.
- 현재 개발 서버 주소는 `http://127.0.0.1:1420` 입니다.
- 포트 `1420` 충돌 시 아래 명령으로 기존 프로세스를 종료할 수 있습니다: `lsof -ti tcp:1420 | xargs kill`

## 자주 쓰는 개발 명령어

프런트엔드 프로덕션 빌드:

```bash
npm run build
```

프런트엔드 결과 미리보기:

```bash
npm run preview
```

TypeScript 타입 체크:

```bash
./node_modules/.bin/tsc --noEmit
```

Rust 체크:

```bash
cd src-tauri
cargo check
cd ..
```

Tauri 전체 빌드:

```bash
npm run tauri build
```

## 개발 시 Git 사용법

이 프로젝트에서 가장 안전한 기본 흐름은 아래 순서입니다.

1. 현재 상태 확인
2. 원격 변경 가져오기
3. 내 변경만 스테이징
4. 커밋
5. 푸시

### 1. 현재 상태 확인

작업 전후로 먼저 아래 명령을 확인합니다.

```bash
git status -sb
```

자주 보는 상태 예시:

- `working tree clean`: 커밋할 변경 없음
- `M README.md`: 수정된 파일이 있음
- `?? some-file.txt`: Git이 아직 추적하지 않는 새 파일
- `ahead 1`: 로컬 커밋이 원격보다 1개 앞섬. `git push` 필요
- `behind 1`: 원격 커밋이 로컬보다 1개 앞섬. `git pull` 필요

### 2. 먼저 원격 변경 가져오기

협업 중이거나 GitHub 원격 저장소를 같이 쓰는 경우, 커밋 전에 먼저 최신 변경을 받는 편이 안전합니다.

```bash
git pull
```

`git pull`은 보통 아래 두 동작을 한 번에 수행합니다.

- `git fetch`: 원격 변경 가져오기
- `git merge`: 가져온 변경을 현재 브랜치에 병합

원격과 내 로컬 변경이 서로 다르면 자동 머지 커밋이 생길 수 있습니다.

### 3. 변경 파일 스테이징

모든 변경을 한 번에 올리려면:

```bash
git add -A
```

특정 파일만 올리려면:

```bash
git add README.md
git add src-tauri/src/main.rs
```

스테이징 후 확인:

```bash
git status
```

### 4. 커밋

```bash
git commit -m "변경 내용을 설명하는 커밋 메시지"
```

좋은 커밋 메시지 예시:

- `Add cargo clean troubleshooting guide`
- `Fix file delete error on Windows`
- `Improve directory size calculation`

### 5. 푸시

```bash
git push
```

로컬 브랜치가 원격보다 앞서 있으면 이 명령으로 GitHub에 반영됩니다.

### 권장 작업 순서 예시

이미 수정한 파일이 있는 상태에서 일반적으로는 아래 순서가 무난합니다.

```bash
git status -sb
git pull
git add -A
git commit -m "설명"
git push
```

아직 수정한 것이 없고 단순히 원격 최신 상태만 받고 싶다면:

```bash
git pull
```

이미 로컬 커밋을 만들어 둔 상태라면:

```bash
git pull
git push
```

### `nothing to commit, working tree clean`의 의미

아래 메시지는 에러라기보다 "새로 커밋할 파일이 없다"는 뜻입니다.

```text
nothing to commit, working tree clean
```

이 경우는 보통 둘 중 하나입니다.

- 이미 이전에 커밋을 만들어 둔 상태
- `git pull`이 자동 머지 커밋을 만든 뒤 더 이상 추가 변경이 없는 상태

즉, 새 커밋이 필요 없는 상황일 수 있으므로 `git status -sb`와 `git log --oneline --decorate -5`로 현재 상태를 확인한 뒤 그냥 `git push`만 하면 되는 경우가 많습니다.

### `git add -A && git commit ... && git push` 사용 시 주의

아래처럼 명령을 한 줄로 묶어 쓰는 경우:

```bash
git add -A && git commit -m "메시지" && git push
```

`git commit` 단계에서 커밋할 내용이 없으면 그 명령은 성공으로 처리되지 않을 수 있고, 그 뒤의 `git push`가 실행되지 않을 수 있습니다.

즉 아래 상황이 가능합니다.

- 이미 커밋은 만들어져 있음
- 작업 트리는 깨끗함
- 그런데 `git commit`이 중단되어 `git push`가 안 됨

이럴 때는 다시:

```bash
git push
```

만 실행하면 됩니다.

### 자주 쓰는 확인 명령

최근 커밋 보기:

```bash
git log --oneline --decorate -5
```

브랜치 상태 간단히 보기:

```bash
git status -sb
```

원격 저장소 확인:

```bash
git remote -v
```

### 이 프로젝트에서 보통 커밋하지 않는 것

아래 항목은 생성물 또는 의존성이라 일반적으로 Git에 올리지 않습니다.

- `node_modules/`
- `dist/`
- `src-tauri/target/`

이들은 `.gitignore`에 의해 제외되며, 필요할 때 다시 생성됩니다.

### 충돌이나 머지가 생겼을 때

`git pull` 후 자동 머지가 실패하면 충돌 파일을 수정한 뒤 다시 커밋해야 합니다.

기본 흐름:

```bash
git status
```

충돌 파일 수정 후:

```bash
git add 충돌난파일
git commit
git push
```

### 최소 권장 습관

- 작업 시작 전 `git status -sb`
- 푸시 전 `git pull`
- 커밋 후 `git push`
- 이상할 때는 먼저 `git status`와 `git log --oneline --decorate -5` 확인
- 빌드 산출물보다 실제 소스 변경만 커밋

## 설치 파일 만들기

현재 `src-tauri/tauri.conf.json` 에서 `bundle.targets` 가 `"all"` 로 설정되어 있어서, 각 운영체제에서 아래 명령을 실행하면 해당 OS에서 지원하는 번들이 생성됩니다.

공통:

```bash
npm run tauri build
```

산출물 기본 경로:

```text
src-tauri/target/release/bundle/
```

### macOS

모든 macOS 번들 생성:

```bash
npm run tauri build
```

`.dmg`만 생성:

```bash
npm run tauri build -- --bundles dmg
```

`.app`만 생성:

```bash
npm run tauri build -- --bundles app
```

출력 예시:

- `src-tauri/target/release/bundle/dmg/*.dmg`
- `src-tauri/target/release/bundle/macos/*.app` 또는 Tauri가 생성한 macOS bundle 디렉터리

### Windows

NSIS 설치 파일 `.exe` 생성:

```bash
npm run tauri build -- --bundles nsis
```

MSI 설치 파일 생성:

```bash
npm run tauri build -- --bundles msi
```

둘 다 생성:

```bash
npm run tauri build -- --bundles nsis,msi
```

출력 예시:

- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/bundle/msi/*.msi`

### Linux

Debian 패키지 생성:

```bash
npm run tauri build -- --bundles deb
```

AppImage 생성:

```bash
npm run tauri build -- --bundles appimage
```

RPM 생성:

```bash
npm run tauri build -- --bundles rpm
```

여러 개 동시 생성:

```bash
npm run tauri build -- --bundles deb,appimage,rpm
```

출력 예시:

- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`
- `src-tauri/target/release/bundle/rpm/*.rpm`

## 문제 해결

### 1. esbuild 플랫폼 오류가 날 때

예:

```text
You installed esbuild for another platform than the one you're currently using
```

해결:

```bash
npm rebuild esbuild
```

그래도 안 되면 의존성을 다시 설치합니다.

```bash
rm -rf node_modules package-lock.json
npm install
```

### 2. 포트 1420이 이미 사용 중일 때

예:

```text
Error: Port 1420 is already in use
```

해결:

```bash
lsof -ti tcp:1420 | xargs kill
```

그 다음 다시 실행합니다.

```bash
npm run tauri dev
```

### 3. `src-tauri/target` 폴더가 너무 커질 때

Rust/Tauri 프로젝트는 빌드할 때 `src-tauri/target/` 아래에 많은 산출물을 생성합니다.

이 폴더에는 다음이 포함됩니다.

- 디버그 빌드 산출물
- 릴리스 빌드 산출물
- 증분 컴파일 캐시(`incremental`)
- 라이브러리/오브젝트 파일(`.rlib`, `.lib`, `.o`)
- 디버그 심볼 파일(`.pdb`)
- 설치 파일 번들 중간 산출물

프로젝트를 여러 번 빌드하거나 `dev`, `build`를 반복하면 이 폴더가 수 GB에서 수십 GB까지 커질 수 있습니다.

이럴 때는 `cargo clean`으로 Rust 빌드 산출물을 정리할 수 있습니다.

프로젝트 루트에서 실행:

```bash
cargo clean --manifest-path src-tauri/Cargo.toml
```

또는 `src-tauri`로 이동해서 실행:

```bash
cd src-tauri
cargo clean
cd ..
```

`cargo clean`이 하는 일:

- `src-tauri/target/` 아래의 컴파일 결과물을 삭제합니다.
- 다음 빌드 때 필요한 파일은 자동으로 다시 생성됩니다.
- 소스 코드(`src/`, `src-tauri/src/`)는 삭제하지 않습니다.
- `node_modules`나 프런트엔드 결과물은 정리하지 않습니다.

이 프로젝트에서 특히 효과가 큰 이유:

- Tauri 앱은 프런트엔드뿐 아니라 Rust 백엔드도 함께 빌드합니다.
- Windows에서는 `.pdb`, `.lib`, `.rlib` 같은 파일이 크게 생성될 수 있습니다.
- `debug`와 `release` 빌드를 모두 수행하면 `target/` 안에 캐시가 중복으로 쌓입니다.

언제 실행하면 좋은가:

- 프로젝트 폴더 용량이 갑자기 크게 늘었을 때
- Rust/Tauri 빌드를 오래 반복해서 `target/`이 비대해졌을 때
- 디스크 공간이 부족할 때
- 빌드 캐시를 초기화하고 다시 깨끗하게 빌드하고 싶을 때

주의:

- 다음 `npm run tauri dev` 또는 `npm run tauri build` 실행 시 Rust 쪽을 다시 컴파일하므로 첫 빌드는 더 오래 걸릴 수 있습니다.
- `cargo clean`은 속도를 위해 저장해 둔 캐시를 지우는 것이므로, 용량 절약과 빌드 시간 사이의 교환이 있습니다.

참고:

- `src-tauri/target/`은 Git 추적 대상이 아니므로 정리해도 버전 관리에는 영향이 없습니다.
- 프런트엔드 용량까지 함께 정리하려면 필요에 따라 `dist/`나 `node_modules/`도 별도로 관리해야 합니다.

## 개발 메모

- Tauri 개발 실행: `npm run tauri dev`
- 프런트엔드 빌드: `npm run build`
- 설치 파일 빌드: `npm run tauri build`
- 앱 번들 설정: `src-tauri/tauri.conf.json`
- Rust 백엔드 소스: `src-tauri/src/`
- React 프런트엔드 소스: `src/`
