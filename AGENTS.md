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

## 탐색 범위 가드레일

- 저장소 전체를 검색하거나 파일 목록을 넓게 나열하기 전에 루트의 [`.gitignore`](./.gitignore)와 [`.claudeignore`](./.claudeignore)를 확인합니다.
- Codex는 `.gitignore`나 `.claudeignore`를 자동 강제하지 않는다고 가정합니다. 따라서 두 파일에 정의된 경로의 **합집합**을 기본 탐색 제외 대상으로 취급합니다.
- `rg --files`, `find`, 저장소 루트 기준 `rg` 같은 광범위 탐색은 가능하면 위 제외 경로를 빼고 실행합니다.
- 예외는 아래 경우만 허용합니다:
  1. 사용자가 해당 경로를 명시적으로 보거나 수정하라고 요청한 경우
  2. 빌드, 테스트, 디버깅, 릴리즈 문제를 해결하는 데 직접 필요한 경우
  3. 생성 산출물이나 로그를 최소 범위로 검증해야 하는 경우
- 예외가 필요하면 폴더 전체를 다시 훑지 말고, 필요한 파일 또는 하위 경로만 좁혀 읽습니다. 왜 읽는지 진행 메시지나 최종 보고에 남깁니다.
- 현재 저장소 기준으로 기본 제외 우선순위가 높은 경로 예시는 `node_modules/`, `dist/`, `dist-ssr/`, `coverage/`, `src-tauri/target/`, `.git/`, `.claude/worktrees/`, `.omc/`, `.omx/logs/`, `.omx/state/`, `.env*`, 각종 `*.log` 입니다.
- [`.claudeignore`](./.claudeignore)는 에이전트 탐색 가드레일 파일입니다. 변경이 필요하면 [scripts/generate-claudeignore.sh](./scripts/generate-claudeignore.sh)를 먼저 수정하고, 스크립트로 `.claudeignore`를 재생성합니다. 한쪽만 수동 수정하고 끝내지 않습니다.

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

## 작업 흐름

모든 코드 수정 작업은 다음 순서를 따릅니다.

```
Plan → Modify → Verify → Fix → Re-verify → Report → Commit
```

1. **Plan** — 관련 파일과 검증 명령을 확인하고, 변경 범위를 사용자 요청 최소치로 확정합니다.
2. **Modify** — 확정된 범위 안에서만 코드를 수정합니다.
3. **Verify** — 변경 범위에 맞는 검증 명령을 실행합니다.
4. **Fix** — 검증 실패 시 로그를 읽고 원인을 수정합니다.
5. **Re-verify** — 수정 후 동일 검증을 다시 실행합니다.
6. **Report** — 아래 보고 템플릿에 따라 결과를 정리합니다.
7. **Commit** — 사용자의 명시적 승인을 받은 뒤에만 커밋합니다.

### 금지 사항

- 테스트 생략 금지
- 실패 로그 무시 금지
- 검증 미통과 상태 커밋 금지
- 사용자 승인 없는 커밋 금지
- TypeScript 오류를 `any`로 임시 우회 금지
- `// @ts-ignore` 남용 금지
- Rust `unwrap()` / `expect()` 남용 금지
- Rust clippy 경고 무시 금지
- Tauri 권한 과다 허용 금지
- React 컴포넌트 변경 시 TypeScript 타입·렌더링 영향 확인 생략 금지
- Tauri command 변경 시 Rust 함수, invoke 호출부, 프런트엔드 타입을 함께 확인하지 않는 것 금지

## 검증

패키지 매니저: `npm` (package-lock.json 기준).

### 검증 명령 참조

| 범위 | 명령 |
|---|---|
| Frontend typecheck | `npm run typecheck` |
| Frontend test | `npm run test` |
| Frontend build | `npm run build` |
| **Frontend 전체** | **`npm run verify:frontend`** |
| Rust fmt check | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` |
| Rust clippy | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` |
| Rust test | `npm run test:rust` |
| **Rust/Tauri 전체** | **`npm run verify:rust`** |
| **Frontend + Rust 전체** | **`npm run verify`** |
| 릴리즈 포함 전체 | `npm run verify:release` (Tauri 빌드 포함, 느림) |

> **ESLint:** 현재 미도입. 도입 전까지 `verify:frontend`에 포함되지 않습니다.

### 변경 범위별 최소 검증 원칙

- 프런트엔드 변경: `npm run verify:frontend`
- Rust/Tauri 변경: `npm run verify:rust`
- 양쪽 모두 변경: `npm run verify`
- 릴리즈 준비: `npm run verify:release`

수정한 파일 범위에 맞는 가장 작은 검증부터 실행하고, 무엇을 실행했는지와 무엇을 실행하지 못했는지를 답변에 분명히 적습니다.

## 커밋 게이트

커밋은 다음 조건을 **모두** 만족할 때만 허용합니다.

- [ ] `npm run typecheck` 통과
- [ ] `npm run test` 통과
- [ ] `npm run build` 통과
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 통과
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` 통과
- [ ] `npm run test:rust` 통과
- [ ] 실패가 있었다면 수정 후 재검증 완료
- [ ] 검증 결과 보고서 작성 완료
- [ ] **사용자의 명시적 커밋 승인**

다음 경우에는 커밋 금지:

- 검증 미실행 또는 일부 생략
- typecheck / test / build / clippy / fmt 중 하나라도 실패
- 실패 로그 미확인
- 사용자 승인 없음

## 작업 완료 보고 템플릿

모든 코드 변경 작업 완료 후 아래 형식으로 보고합니다.

```markdown
## 작업 요약

- 변경 목적:
- 주요 변경 파일:
- 변경 범위:

## 변경 상세

- Frontend:
- Rust/Tauri:
- 설정/자동화:
- 테스트:
- 크로스플랫폼 고려사항: (macOS / Windows / Linux 영향 여부, 경로 구분자·파일명 인코딩·권한 차이 등)

## 검증 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ / ❌ |
| Frontend Test | `npm run test` | ✅ / ❌ |
| Frontend Build | `npm run build` | ✅ / ❌ |
| Rust Format | `cargo fmt -- --check` | ✅ / ❌ |
| Rust Clippy | `cargo clippy -- -D warnings` | ✅ / ❌ |
| Rust Test | `npm run test:rust` | ✅ / ❌ |
| Tauri Build | `npm run verify:release` | 실행 여부 / ✅ / ❌ |

## 실패 및 수정 내역

- 최초 실패:
- 실패 원인:
- 수정 내용:
- 재검증 결과:

## 커밋 가능 여부

- 커밋 가능 여부: Yes / No
- 남은 위험:
- 사용자 승인 필요 여부: Yes
```

## 커밋 및 빌드 위생

- 커밋 메시지는 영어로 작성합니다.
- `dist/`, `src-tauri/target/` 같은 빌드 산출물은 커밋하지 않습니다.
- `src-tauri/target/`은 매우 커질 수 있으므로, 실제 정리가 필요할 때만 `cargo clean --manifest-path src-tauri/Cargo.toml`를 사용합니다.
- 작업 트리가 더러운 상태일 수 있으므로, 사용자의 무관한 변경은 되돌리지 않습니다.

## Git Hook (Lefthook)

`lefthook.yml`을 통해 pre-commit과 pre-push 게이트가 설정되어 있습니다.
초기 설치 시 `npm install` 후 `npx lefthook install`을 실행합니다.

- **pre-commit:** `typecheck` + `test` (빠른 검증)
- **pre-push:** `verify` (전체 검증)

## 릴리즈 / 태그 절차

- 릴리즈 작업은 **기능 변경 커밋**과 **버전/태그 커밋**을 분리합니다.
- 태그나 릴리즈를 만들기 전에는 최소 `npm run test:all` 을 실행합니다. 프런트엔드 번들, 배포 산출물, Tauri 패키징 영향이 있으면 `npm run build` 도 추가합니다.
- 버전 업데이트는 기본적으로 `npm version <patch|minor|major> --no-git-tag-version` 을 사용합니다. 자동 커밋/자동 태그를 피하고, `version-sync.cjs` 로 `src-tauri/tauri.conf.json` 동기화를 함께 처리하기 위함입니다.
- 버전 커밋에는 `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` 만 포함합니다.
- 릴리즈 커밋 메시지도 Lore 규칙을 따르며 영어로 작성합니다.
- 태그는 항상 annotated tag 형식 `v<version>` 으로 생성합니다.
- 푸시 순서는 `git push origin main` 다음 태그 푸시를 기본으로 합니다. 필요 시 `npm run release:push` 를 사용할 수 있습니다.
- 기존 릴리즈 태그를 재사용하거나 다른 커밋으로 이동시키지 않습니다.
- 버전 수준이 명확하지 않으면, 버그 수정/문서/내부 안정화 성격은 `patch` 를 기본으로 보고, 사용자 영향이 있는 기능 추가나 호환성 변경 가능성이 있으면 사용자와 기준을 확인합니다.

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
