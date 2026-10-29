# MyCommander 리팩토링 정책

본 문서는 MyCommander 프로젝트의 프런트엔드와 Rust 백엔드 전반에 걸친 리팩토링 원칙, 트리거 기준, 디렉터리 구조 유지 기준 및 작업 절차를 정의합니다.
실제 기능 구현이나 버그 수정 규칙은 [`AGENTS.md`](../AGENTS.md)를, 아키텍처와 설계 정책은 [`CLAUDE.md`](../CLAUDE.md)를 참조하세요.

## 1. 리팩토링 원칙 (Principles)

- **기능 변경 없는 구조 개선:** 리팩토링은 기존 동작을 바꾸지 않으면서 가독성, 유지보수성, 테스트 용이성을 높이는 작업입니다.
- **점진적 적용 (Boy Scout Rule):** 대규모 리팩토링을 한 번에 진행하기보다, 기능 추가나 버그 수정으로 해당 영역을 건드릴 때 관련된 구조를 함께 개선합니다.
- **테스트 커버리지 선행:** 리팩토링 대상 코드의 동작을 보장하는 테스트가 있는지 확인하고, 부족하다면 테스트 보강을 먼저 진행합니다.
- **AGENTS.md 절차 준수:** `Plan → Modify → Verify → Fix → Re-verify → Report → Commit` 작업 흐름을 엄격히 따릅니다.

## 2. 리팩토링 트리거 기준 (When to Refactor)

코드를 개선해야 하는 정량적, 정성적 기준입니다.

### 정량적 기준

- **파일 크기:** 소스 파일(`.ts`, `.tsx`, `.rs`)이 **300줄**을 초과할 경우 기능 분리 및 추출을 강력히 검토합니다.
- **디렉터리 파일 수:** 한 디렉터리에 성격이 다른 파일이 **20개 이상** 쌓이면 논리적 하위 디렉터리로 그룹화를 검토합니다.
- **코드 중복:** 동일한 패턴이나 유틸리티 로직이 **3곳 이상**에서 발견되면 공통 함수나 모듈로 추출합니다.

### 정성적 기준

- 파일을 열었을 때 주요 로직 파악을 위해 스크롤이 과도하게 필요한 경우
- 새로운 기능을 추가하기 위해 파일 내 무관한 코드를 이해해야 하는 경우
- 테스트 작성 시 의존성이나 상태 초기화를 위한 Mock 설정이 지나치게 복잡한 경우

## 3. 디렉터리 구조 유지 가이드라인

초기 플랫(flat) 구조에서 커진 프런트엔드 디렉터리는 역할과 관심사에 따라 1차 그룹화를 완료했습니다. 이후 새 파일을 추가하거나 기존 파일을 이동할 때는 아래 경계를 유지합니다.

### 3.1. Frontend (`src/components/panel/` 및 `dialogs/`)

#### `components/panel/`
패널의 핵심 화면 파일(`FilePanel.tsx`, `FileList.tsx`, `FileItem.tsx`, 주소/탭/드라이브 UI 등)은 루트에 두고, 기능별 보조 로직은 하위 디렉터리에 둡니다.

- **`drag/`**: 드래그 앤 드롭 관련 (`fileListDrag*.ts`, `useFileListDrag*.ts` 등)
- **`visuals/`**: 아이콘, 색상 등 시각적 표현 (`fileVisual*.ts` 등)
- **`size/`**: 디렉터리 크기 계산 및 표시 (`useBackgroundDirSizes.ts` 등)
- **`selection/`**: 파일 선택 상태 관리 (`useFileListSelection.ts` 등)

#### `components/dialogs/`
공통 다이얼로그 기반 파일 작업 UI는 루트에 두고, 목적이 분명한 다이얼로그 묶음은 하위 디렉터리에 둡니다.

- **`search/`**: 검색 UI 및 로직 (`Search*.tsx`, `useSearch*.ts`, `searchOptions.ts`)
- **`preview/`**: 퀵 프리뷰 (`QuickPreview*.tsx`, `quickPreview*.ts`, `useQuickPreview*.ts`)
- **`sync/`**: 디렉터리 동기화 (`SyncDialog.tsx`, `syncDialogHelpers.ts`, `useSyncDialogState.ts`)
- **`jobs/`**: 작업 큐 및 상태 표출 (`ProgressDialog.tsx`, `JobCenter*.tsx`, `jobCenterHelpers.ts`)
- **`palette/`**: 커맨드 팔레트 (`CommandPalette*.tsx`, `commandPalette*.ts`, `useCommandPalette*.ts`)

새 다이얼로그가 위 그룹에 자연스럽게 속하지 않으면 루트에 두되, 같은 주제의 파일이 3개 이상으로 늘어날 때 하위 디렉터리 생성을 검토합니다.

### 3.2. Rust Backend (`src-tauri/src/`)

Rust 백엔드는 현재 `fs/`, `system/`, `jobs/` 등으로 모듈화가 잘 되어 있습니다. 다음 원칙을 유지합니다:
- 각 모듈은 `mod.rs`를 통해 API 경계를 명확히 정의합니다.
- 새로운 `tauri::command` 추가 시 적절한 기존 하위 모듈에 배치하거나, 성격이 다르면 새 모듈을 생성합니다.
- `lib.rs` 비대화를 막기 위해 라우팅/등록 로직만 유지하고, 실제 비즈니스 로직은 분리된 모듈에 작성합니다.

## 4. 리팩토링 유형별 가이드라인

1. **파일 분할 (File Splitting):**
   - 300줄 초과 시 컴포넌트의 렌더링 로직과 상태 관리 로직(Custom Hook)을 분리합니다.
   - 단일 파일 내 복수의 독립된 유틸리티 함수나 타입이 있다면 각각 파일로 분리합니다.
2. **관심사 이동 (Cohesion):**
   - `features/`나 전역 `utils/`에 있는 로직 중 특정 컴포넌트에서만 쓰이는 로직은 해당 컴포넌트와 같은 디렉터리(Co-location)로 이동합니다.
3. **인터페이스 단순화:**
   - 여러 상태나 플래그를 조합해 넘기는 대신, 파생 상태(Derived State)를 계산하거나 객체로 응집시켜 컴포넌트 Props를 단순화합니다.

## 5. 작업 절차 및 안티패턴

### 작업 절차
1. 변경 전 전체 테스트 및 타입 검사 통과 여부를 확인합니다.
2. 리팩토링 정책 기준에 부합하는 대상을 식별하고 작업 범위를 한정합니다.
3. 소스 코드 이동 및 분리 진행 시 **해당 테스트 파일도 함께 이동(Co-location)** 합니다.
4. 변경 후 아래 명령을 통해 무결성을 검증합니다.
   - Frontend: `npm run verify:frontend`
   - Rust: `npm run verify:rust`
5. 리뷰 및 커밋 진행. 커밋 메시지는 [`AGENTS.md`](../AGENTS.md)의 Lore Commit Protocol을 따릅니다.

### 안티패턴 (금지 사항)
- **기능 변경 믹스:** 리팩토링 커밋과 새로운 기능 추가/버그 수정을 한 커밋에 섞지 마세요.
- **리팩토링을 위한 리팩토링:** 동작을 담보하는 테스트 없이, 혹은 실제 유지보수 문제가 없는 곳을 단순 미적 이유로 구조를 갈아엎지 마세요.
- **과도한 중첩 (Deep Nesting):** 디렉터리 구조를 분할할 때 3단계를 초과하는 깊은 폴더 트리를 만들지 마세요.
- **불필요한 Barrel Export:** Circular Dependency를 유발할 수 있는 무분별한 `index.ts` 생성을 피하세요.

## 6. 현재 리팩토링 백로그 (2026-05 기준)

- **P1 (높음):** `components/panel/size/useBackgroundDirSizes.ts` (388줄), `store/panelStoreFileActions.ts` (370줄) - 컴포넌트 기능 개선 시 분할 우선 검토
- **P2 (보통):** `components/panel/`, `components/dialogs/` 초기 하위 디렉터리 그룹화는 완료. 신규 파일 추가 시 현행 그룹 경계를 유지하고, 루트에 다시 대량 누적되지 않도록 점검
- **P3 (낮음):** 상태 바(`StatusBar.tsx`) 등 UI 컴포넌트 내부 렌더링 헬퍼 분리
