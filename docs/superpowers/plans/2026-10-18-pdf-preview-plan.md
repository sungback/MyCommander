# PDF 빠른 미리보기 개선 계획

- 작성일: 2026-10-18
- 기준 커밋: `c5c163c` (1.2.60)
- 목표: Space로 연 Quick Preview에서 PDF를 페이지 썸네일 목록과 함께 보여 주고, 아래/위 화살표로 한 장씩 넘긴다.

## 현재 구현
- `quickPreviewHandlers.ts`가 PDF를 `{ type: "pdf", src: convertFileSrc(path) }`로 만들고, `QuickPreviewDialogViews.tsx`가 `<iframe>`에 넘겨 웹뷰 내장 PDF 뷰어로 보여 준다.
- 내장 뷰어는 플랫폼마다 다르고(macOS WKWebView, Windows WebView2, Linux WebKitGTK는 표시하지 못할 수 있음), 앱에서 페이지·썸네일·키 입력을 제어할 수 없다.
- 미리보기가 열려 있으면 전역 키 처리(`keyboardShortcuts.ts`의 `closeOpenDialog`)가 중단되고, 미리보기 창은 Space(닫기)만 처리한다. 화살표 키는 비어 있다.
- CSP는 `connect-src`에 `asset:`을 허용하고 `worker-src`가 없어 `script-src 'self'`를 따른다(같은 출처 Web Worker 허용).

## 방식
- PDF를 앱이 직접 그린다: `pdfjs-dist`(Mozilla pdf.js)를 지연 로드하고, Web Worker에서 해석해 `<canvas>`에 그린다.
- 대안과 비교:
  - 내장 뷰어(`<iframe>`) 유지: 썸네일·키 제어가 불가능해 요구를 만족하지 못한다.
  - Rust에서 PDFium으로 렌더링: 플랫폼별 바이너리를 앱에 넣어야 하고 배포가 무거워진다.

## 화면과 조작
- 왼쪽: 페이지 썸네일 세로 목록(1, 2, 3, 4, …). 현재 페이지를 강조하고, 넘길 때 목록이 따라 스크롤된다. 클릭하면 그 페이지로 이동한다.
- 오른쪽: 현재 페이지 한 장을 창에 맞춰 크게 표시한다. 헤더 또는 푸터에 `3 / 12` 페이지 표시.
- 키:
  - `↓` / `PageDown` / `→`: 다음 페이지, `↑` / `PageUp` / `←`: 이전 페이지
  - `Home` / `End`: 첫 / 마지막 페이지
  - `Space`: 닫기(기존 동작 유지), `Esc`: 닫기
- 다른 파일 형식의 미리보기 동작은 바꾸지 않는다.

## 구현 단계
### 1. 의존성과 로딩 (승인 필요)
- [x] `pdfjs-dist` 추가(2026-10-18 사용자 승인). npm 레지스트리 기준 최신 6.4.299(2026-10-18 확인), Apache-2.0, `node_modules` 기준 약 35 MB.
  - 선택 의존성 `@napi-rs/canvas`는 Node에서 그릴 때만 쓰며 앱에는 들어가지 않는다. 설치 시 플랫폼용 바이너리를 받을 수 있다.
  - 엔진 요구 `node >=22.13`: 로컬 v24.15.0, CI `node-version: 22`(최신 22.x)로 충족한다.
- [x] pdf.js는 `pdf/pdfDocument.ts`를 동적 import할 때만 받는다(본체 437 KB, worker 1.26 MB는 별도 파일). 첫 화면 번들은 PDF 화면 컴포넌트 몫으로 약 7 KB 늘었다.
- [x] CMap(한·중·일 글꼴 매핑), 표준 글꼴, WebAssembly 대체 JS는 `scripts/vitePdfjsResources.mjs` 플러그인이 같은 출처의 `/pdfjs/` 아래에서 제공한다(개발 서버는 node_modules에서 응답, 빌드는 해시 없이 출력. 약 3 MB).
- [x] eval: pdf.js 6.x는 eval을 쓰지 않아 `isEvalSupported` 옵션 자체가 없어졌다.
- [x] WebAssembly: `useWasm: false`로 두어 이미지 해독(JPEG 2000, JBIG2)에 같은 출처의 JS 대체 모듈을 쓴다. CSP는 바꾸지 않았다. WebAssembly보다 느릴 수 있다.

### 2. 문서 로드
- [x] asset URL(`convertFileSrc`)로 연다. Tauri 2.12 asset 프로토콜은 앱 출처 CORS 헤더와 Range를 지원한다.
- [x] URL로 열지 못하면(asset 범위 밖 경로 등) 기존 `read_file_binary`(최대 20 MB, 민감 경로 차단 동일)로 바이트를 받아 연다. 암호 오류는 다시 시도하지 않는다.
- [x] 암호가 걸린 PDF, 손상된 PDF는 오류 화면과 "기본 뷰어로 보기"(기존 `<iframe>`)를 둔다. 정상 문서에서도 도구 줄에서 기본 뷰어로 바꿀 수 있다.
- [x] 미리보기를 닫거나 파일이 바뀌면 열기 작업을 취소하거나 문서를 해제한다(pdf.js 6.x는 `PDFDocumentLoadingTask.destroy()`로 문서와 worker를 함께 정리).

### 3. 페이지 보기
- [x] 현재 페이지를 창 크기와 `devicePixelRatio`에 맞춰 그린다. 창 크기가 바뀌면 다시 그린다(`ResizeObserver`).
- [x] 페이지를 넘기면 진행 중인 렌더링을 취소한다(`RenderTask.cancel()`).
- [x] 페이지 이동은 순수 함수 `getPdfPageForKey`로 분리해 테스트한다.

### 4. 썸네일 목록
- [x] 화면에 보이는(앞뒤 200px 포함) 썸네일만 그린다(`IntersectionObserver`). 페이지 수만큼 고정 크기 자리 표시자를 두는 방식이라 가상 스크롤보다 단순하다.
- [x] 썸네일은 폭 112px로 그리고 동시에 2개까지만 그린다. 그린 결과는 PNG 객체 URL로 바꿔 캔버스 메모리를 돌려주고, 문서를 닫을 때까지 재사용한다.
- [x] 현재 페이지 썸네일이 보이도록 목록을 자동 스크롤한다.

### 5. 검증
- [x] 단위 테스트: 페이지 이동(경계, Home/End), 키 처리(Space는 넘기지 않음), 썸네일 클릭, 로드 실패 시 대체 경로, 암호 문서, 닫을 때 해제, 렌더 동시 실행 제한. pdf.js는 `loadRenderer`를 mock한다.
- [ ] 실제 앱 확인: 작은 PDF, 수백 페이지 PDF, 큰 이미지 PDF, 암호 PDF, 손상된 PDF, asset 범위 밖 PDF.
- [x] `npm run verify`, 번들 크기 변화 확인(첫 화면 번들 +약 7 KB, pdf.js는 별도 파일).
- [x] 릴리즈 빌드의 worker MIME: Tauri(tauri-utils 2.8.3)는 `.mjs`를 `text/javascript`로 보낸다(소스 확인).
- [x] CLAUDE.md(비명시적 동작, 기술 스택)와 README(PDF 미리보기 키)에 반영했다.

## 범위 밖 (후속 후보)
- 확대/축소, 텍스트 선택·검색, 연속 스크롤 보기
- ZIP 안의 PDF 미리보기(`QuickPreviewZipView`)
- 썸네일을 디스크에 캐시

## 결정 필요
- `pdfjs-dist` 추가 승인
- 썸네일 위치: 왼쪽(추천, macOS 미리보기 앱과 같은 배치) / 오른쪽
- 넘기는 방식: 한 장씩 바뀌는 보기(추천, 요청과 동일) / 세로 연속 스크롤에서 페이지 단위로 맞춤
