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
