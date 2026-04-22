# MyCommander - AGENTS.md

이 파일은 저장소 전체에 적용됩니다.

## 이 파일의 역할

- `CLAUDE.md`는 프로젝트 컨텍스트 문서입니다.
- 이 파일은 에이전트 작업 가이드입니다. 어떻게 작업하고, 어떻게 검증하고, 어떤 저장소 특화 실수를 피해야 하는지를 정의합니다.
- 두 문서의 역할은 분리합니다.
  - 프로젝트 사실, 아키텍처, 디렉터리 구조는 `CLAUDE.md`에 기록합니다.
  - 에이전트 작업 방식, 가드레일, 검증 규칙은 `AGENTS.md`에 기록합니다.

## 작업 전 필수 단계

- 프로젝트 전반에 대한 가정을 하기 전에 [`CLAUDE.md`](./CLAUDE.md)를 먼저 읽습니다.
- 코드베이스 질문에 답하거나 아키텍처를 추정하기 전에, 관련 저장소 파일을 직접 확인합니다.

## 작업 방식

- 변경은 현재 기능 또는 버그 범위 안에서 작고 국소적으로 유지합니다.
- 새로운 패턴을 들여오기보다, 기존 코드 스타일과 파일 배치를 최대한 따릅니다.
- `README.md`는 사용자용, `CLAUDE.md`는 구현 컨텍스트용, `AGENTS.md`는 작업 규칙용으로 유지합니다.
- 프런트엔드 스타일링에는 Tailwind 유틸리티 클래스를 사용합니다.
- 공유 프런트엔드 상태에는 Zustand를 사용합니다.
- 새 Tauri command 추가 시 아래 4단계를 순서대로 완료합니다:
  1. `src-tauri/src/commands/*.rs` 에 함수 작성
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
- `1420` 포트가 점유된 경우 `lsof -ti tcp:1420 | xargs kill` 를 사용합니다.
- Tauri 권한 문제가 발생하면 `src-tauri/permissions/` 와 `src-tauri/tauri.conf.json` 을 함께 확인합니다.
- 빌드가 예상과 다르게 실패하면 저장소 루트의 `build_log.txt` 를 확인합니다.
- `.omc/`, `.omx/` 는 도구/설정 디렉터리이므로, 명시적으로 필요한 작업이 아니면 수정하지 않습니다.
- **유니코드 파일명 정책 / 새 파일 다이얼로그 기본값:** [`CLAUDE.md` 설계 정책](./CLAUDE.md#설계-정책) 참조.
- **ESM/Vite 호환성:** 프런트엔드 소스에서 인라인 `require()` 를 사용하지 않습니다. `@types/node` 관련 타입 오류를 피하기 위해 표준 ESM `import` 또는 동적 `import()` 를 사용합니다.
- **서드파티 API 변경 대응:** `react-resizable-panels` 같은 UI 라이브러리를 다룰 때는 실제 export된 정확한 타입을 반드시 확인합니다. 예: `ImperativePanelHandle` 대신 `PanelImperativeHandle`, 레이아웃 반환이 배열이 아니라 맵일 수 있음.
- **Zustand mock 유지보수:** 테스트에서 `"Cannot read properties of undefined"` 오류가 나면 `vi.mock` 안의 mock 데이터 구조가 실제 스토어 정의와 어긋났을 가능성이 큽니다. 새 경계값, 배열, 유틸 export 등이 빠지지 않았는지 실제 구현과 맞춰 확인합니다.
- **macOS CloudStorage symlink 경로:** `~/Dropbox` 같은 경로는 실제 디렉터리가 아니라 `~/Library/CloudStorage/...`를 가리키는 symlink일 수 있습니다. UI/히스토리에는 표시 경로(`currentPath`)를 유지하고, 파일 시스템 접근/비교/감시는 해석된 경로(`resolvedPath`) 기준으로 확인합니다.
- **CloudStorage 열기 버그 검증:** Dropbox류 폴더 열기 문제를 수정할 때는 최소한 더블클릭 진입, 새로고침, 반대 패널 동기화, 감시 경로 수집, 컨텍스트 메뉴 액션이 표시 경로와 실제 경로를 섞어 쓰지 않는지 함께 확인합니다.
