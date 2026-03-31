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

## 개발 메모

- Tauri 개발 실행: `npm run tauri dev`
- 프런트엔드 빌드: `npm run build`
- 설치 파일 빌드: `npm run tauri build`
- 앱 번들 설정: `src-tauri/tauri.conf.json`
- Rust 백엔드 소스: `src-tauri/src/`
- React 프런트엔드 소스: `src/`
