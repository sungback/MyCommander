# MyCommander - AGENTS.md

이 파일은 저장소 전체에 적용되는 에이전트 작업 규칙과 검증 기준입니다.
사용자/기여자용 시작 안내는 [`README.md`](./README.md), 구현 컨텍스트와 설계 정책은 [`CLAUDE.md`](./CLAUDE.md)를 기준으로 합니다.

## 이 파일의 역할

- `README.md`는 사용자와 기여자가 앱을 이해하고 실행하기 위한 시작 문서입니다.
- `CLAUDE.md`는 프로젝트 사실, 아키텍처, 디렉터리 구조, 설계 정책을 담는 구현 컨텍스트 문서입니다.
- `AGENTS.md`는 어떻게 작업하고, 어떻게 검증하고, 어떤 저장소 특화 실수를 피해야 하는지를 정의합니다.
- 세 문서의 역할은 분리합니다.
  - 프로젝트 사실, 아키텍처, 디렉터리 구조는 `CLAUDE.md`에 기록합니다.
  - 에이전트 작업 방식, 가드레일, 검증 규칙은 `AGENTS.md`에 기록합니다.

## 작업 전 필수 단계

- 프로젝트 전반에 대한 가정을 하기 전에 [`CLAUDE.md`](./CLAUDE.md)를 먼저 읽습니다.
- 코드베이스 질문에 답하거나 아키텍처를 추정하기 전에, 관련 저장소 파일을 직접 확인합니다.

## 에이전트 행동 원칙

### 핵심 4대 원칙

- **추측 금지 (Don't Assume):** 모호한 요구 사항이 있으면 독자적으로 판단해 구현하지 않습니다. 사용자 질문이나 저장소 증거로 경계를 먼저 확인합니다.
- **단순함 우선 (Simplicity First):** 문제를 해결하는 최소한의 코드만 작성합니다. 추측성 확장이나 불필요한 추상화는 넣지 않습니다.
- **정밀한 수정 (Surgical Changes):** 요청받은 범위만 정확히 수정합니다. 인접한 스타일, 포맷, 관련 없는 로직을 함께 바꾸지 않습니다.
- **목표 중심 실행 (Goal-Driven Execution):** 코드 작성 전에 성공 기준(테스트·예상 동작)을 먼저 정의하고, 기준을 통과할 때까지 수정과 검증을 반복합니다.

### 운영 지침

- 명시적 요청이 없다면 100KB 이상의 대용량 파일은 건너뜁니다.
- 세션이 길어지면 `/cost` 실행을 제안합니다.
- 완료 선언 전 반드시 범위에 맞는 테스트를 실행합니다.
- 사용자의 지침은 항상 이 문서보다 우선합니다.

## 작업 방식

- 변경은 현재 기능 또는 버그 범위 안에서 작고 국소적으로 유지합니다.
- 새로운 패턴을 들여오기보다, 기존 코드 스타일과 파일 배치를 최대한 따릅니다.
- `README.md`는 사용자용, `CLAUDE.md`는 구현 컨텍스트용, `AGENTS.md`는 작업 규칙용으로 유지합니다.
- 프런트엔드 스타일링에는 Tailwind 유틸리티 클래스를 사용합니다.
- 공유 프런트엔드 상태에는 Zustand를 사용합니다.
- 새 Tauri command 추가 시 아래 4단계를 순서대로 완료합니다:
  1. `src-tauri/src/commands/**` 아래 적절한 모듈에 함수 작성
  2. `src-tauri/src/lib.rs` `invoke_handler!` 에 등록
  3. `src-tauri/permissions/` 에 해당 command 권한 추가
  4. `src-tauri/capabilities/` 에서 해당 permission 포함 여부 확인
  — 3·4번을 빠뜨리면 런타임 권한 오류가 발생합니다.
- 이 저장소는 Tauri v2 전용으로 다룹니다. 검증 없이 Tauri v1 관례를 적용하지 않습니다.
- `CLAUDE.md`에 이미 안정적으로 정리된 프로젝트 배경은 이 문서에 중복 작성하지 말고 링크로 연결합니다.

## 검증

- 프런트엔드 또는 타입 관련 변경:
  - `./node_modules/.bin/tsc --noEmit`
  - `npm run test`
- Rust/Tauri 관련 변경:
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `npm run test:rust`
- 프런트엔드와 Rust 테스트를 한 번에:
  - `npm run test:all`
  - `npm run test:coverage` (커버리지 포함)
- 필요한 경우 전체 프런트엔드 프로덕션 빌드:
  - `npm run build`
- 필요한 경우 전체 앱 수동 실행:
  - `npm run tauri dev`

수정한 파일 범위에 맞는 가장 작은 검증부터 실행하고, 무엇을 실행했는지와 무엇을 실행하지 못했는지를 답변에 분명히 적습니다.

## 커밋 및 빌드 위생

- 커밋 메시지는 영어로 작성합니다.
- `dist/`, `src-tauri/target/` 같은 빌드 산출물은 커밋하지 않습니다.
- `src-tauri/target/`은 매우 커질 수 있으므로, 실제 정리가 필요할 때만 `cargo clean --manifest-path src-tauri/Cargo.toml`를 사용합니다.
- 작업 트리가 더러운 상태일 수 있으므로, 사용자의 무관한 변경은 되돌리지 않습니다.

## 트러블슈팅 메모

- 개발 서버 URL은 보통 `http://127.0.0.1:1420` 입니다.
- `1420` 포트가 점유된 경우 `lsof -ti tcp:1420` 으로 프로세스를 확인한 뒤, 개발 서버로 확인된 경우에만 `kill <pid>` 를 사용합니다.
- Tauri 권한 문제가 발생하면 `src-tauri/permissions/` 와 `src-tauri/tauri.conf.json` 을 함께 확인합니다.
- 빌드가 예상과 다르게 실패하면 저장소 루트의 `build_log.txt` 를 확인합니다.
- `.omc/`, `.omx/` 는 도구/설정 디렉터리이므로, 명시적으로 필요한 작업이 아니면 수정하지 않습니다.
- **유니코드 파일명 정책 / 새 파일 다이얼로그 기본값:** [`CLAUDE.md` 설계 정책](./CLAUDE.md#설계-정책) 참조.
- **ESM/Vite 호환성:** 프런트엔드 소스에서 인라인 `require()` 를 사용하지 않습니다. `@types/node` 관련 타입 오류를 피하기 위해 표준 ESM `import` 또는 동적 `import()` 를 사용합니다.
- **서드파티 API 변경 대응:** `react-resizable-panels` 같은 UI 라이브러리를 다룰 때는 실제 export된 정확한 타입을 반드시 확인합니다. 예: `ImperativePanelHandle` 대신 `PanelImperativeHandle`, 레이아웃 반환이 배열이 아니라 맵일 수 있음.
- **Zustand mock 유지보수:** 테스트에서 `"Cannot read properties of undefined"` 오류가 나면 `vi.mock` 안의 mock 데이터 구조가 실제 스토어 정의와 어긋났을 가능성이 큽니다. 새 경계값, 배열, 유틸 export 등이 빠지지 않았는지 실제 구현과 맞춰 확인합니다.
- **contextMenuStore mock:** 테스트에서 컨텍스트 메뉴 관련 오류가 나면 `vi.mock("../store/contextMenuStore")`가 실제 export 구조(`isOpen`, `position`, `items` 등)와 일치하는지 확인합니다.
- **macOS CloudStorage symlink 경로:** 상세 정책은 [`CLAUDE.md` 설계 정책](./CLAUDE.md#설계-정책) 참조.
- **CloudStorage 열기 버그 검증:** Dropbox류 폴더 열기 문제를 수정할 때는 최소한 더블클릭 진입, 새로고침, 반대 패널 동기화, 감시 경로 수집, 컨텍스트 메뉴 액션이 표시 경로와 실제 경로를 섞어 쓰지 않는지 함께 확인합니다.
- **Zustand 상태 덮어쓰기(State Overwrite) 주의:** 패널 상태를 수동으로 읽어(`getState`) 복잡한 업데이트를 처리할 때, 도중에 `state.action()` 같은 동기적 변경을 호출하면 이전에 읽어둔 구버전 객체로 덮어쓰기가 발생해 변경이 유실될 수 있습니다. 단일 `setState` 또는 하나의 `updater` 안에서 상태 변경을 한 번에 처리해야 합니다.
- **트리 하위 항목(Expanded Folder) 메타데이터:** 패널 스토어의 `files` 배열은 현재 경로의 '루트 항목'만 가집니다. 확장된 하위 폴더의 파일 객체 정보는 전역 상태를 가볍게 유지하기 위해 `FileList.tsx`의 DOM 속성(`data-entry-*`)에 심어둡니다. 우클릭 컨텍스트 메뉴 등에서 하위 항목을 처리할 때는 전역 상태 검색이 실패하면 DOM을 확인하여 `targetEntry`를 재구성해야 합니다.
