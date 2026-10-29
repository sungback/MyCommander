# MyCommander — 구현 컨텍스트

React 19·TypeScript·Vite 프런트엔드와 Tauri v2·Rust 백엔드로 구성된 크로스플랫폼 파일 매니저입니다. 스타일은 Tailwind CSS v4, 공유 상태는 Zustand, 프런트엔드 테스트는 Vitest와 Testing Library를 사용합니다. 의존성과 실행 명령의 실제 값은 [package.json](package.json), Rust 의존성은 [Cargo.toml](src-tauri/Cargo.toml)을 확인합니다.

사용법은 [README.md](README.md), 작업 규칙은 [AGENTS.md](AGENTS.md), 이어서 할 일은 [TASKS.md](TASKS.md)를 참고합니다.

## 설계 정책

아래 동작은 의도된 정책입니다. 관련 변경을 요청받지 않았다면 유지합니다.

- **파일명:** 한글 이름을 NFD로 강제 변환하지 않습니다. NFC 이름이 분해되지 않도록 보존합니다.
- **새 파일 입력:** 기본 파일명은 빈 칸입니다. `New File.txt` 같은 값을 미리 넣지 않습니다.
- **표시 경로와 접근 경로:** `currentPath`는 UI·히스토리용이고 `resolvedPath`는 실제 파일 접근용입니다. CloudStorage와 symlink에서도 표시 경로를 유지합니다. 접근 경로 선택에는 [path.ts](src/utils/path.ts)의 `coalescePanelPath`를 사용합니다. 이 함수는 빈 `resolvedPath`도 처리하므로 단순한 `??`로 대체하지 않습니다.
- **삭제:** 휴지통 이동과 영구 삭제를 구분합니다. 휴지통 이동 실패를 영구 삭제로 대체하지 않습니다. 영구 삭제의 `confirmed_path_count` 확인을 유지합니다.

## 코드 위치

| 위치 | 역할 |
|---|---|
| `src/components/` | dialogs, panel, favorites, layout UI |
| `src/features/` | 파일 작업·동기화 등 기능 로직 |
| `src/hooks/tauriCommands/` | 프런트엔드 Tauri 명령 클라이언트 |
| `src/hooks/useFileSystem.ts` | 컴포넌트·일반 훅이 사용하는 파일시스템 facade |
| `src/store/` | Zustand 상태, 영속화, 패널 갱신 |
| `src/utils/` / `src/types/` | 경로·공유 도우미 / 타입 |
| `src-tauri/src/commands/fs/` | 파일 조회·작업·압축 |
| `src-tauri/src/commands/jobs/` | 작업 큐·진행·실행·영속화 |
| `src-tauri/src/commands/system/` | 드라이브·경로·메뉴·실행 |
| `src-tauri/src/lib.rs` | Tauri 앱 구성과 명령 등록 |
| `src-tauri/permissions/` / `src-tauri/capabilities/` | 명령 권한과 창별 허용 범위 |
| `.github/workflows/` / `scripts/` | CI·릴리즈 / 검증·관리 스크립트 |

## 변경 시 알아야 할 연결 관계

### Tauri 명령과 작업 큐

- 직접 `invoke()` 호출은 `src/hooks/tauriCommands/`에 둡니다. 컴포넌트와 일반 훅은 `useFileSystem()`을 사용합니다.
- [jobCommands.ts](src/hooks/tauriCommands/jobCommands.ts)가 프런트엔드 작업 payload를 Rust의 필드 이름으로 변환합니다. UI 타입만 보고 IPC 필드 이름을 추정하지 않습니다.
- [useJobQueue.ts](src/hooks/useJobQueue.ts)가 작업 복원과 `job-updated` 이벤트를 처리합니다. 삭제 결과는 패널에서 제거한 뒤 갱신하고, 복사·이동 등은 영향 받은 디렉터리를 갱신합니다.
- 진행 UI는 `ProgressDialog`, 작업 이력은 `JobCenterDialog`, 짧은 결과는 `toastStore`와 `ToastViewport`가 담당합니다.

### 패널과 파일 경로

- [panelHelpers.ts](src/utils/panelHelpers.ts)의 `syncPanelWithActiveTab`이 활성 탭과 패널 상단 상태를 맞춥니다.
- 파일 작업 뒤 갱신은 [panelRefresh.ts](src/store/panelRefresh.ts)의 공통 함수를 사용합니다. 같은 폴더를 보는 반대 패널과 확장된 하위 폴더도 고려해야 합니다.
- 이전에 읽은 Zustand 객체로 최신 상태를 덮어쓰지 않도록 주의합니다. 중간에 동기 action을 호출한 뒤 오래된 snapshot을 저장하는 패턴을 피합니다.
- 패널 `files`에는 루트 항목만 있습니다. 확장된 하위 항목은 [fileEntryElement.ts](src/components/panel/fileEntryElement.ts)의 `data-entry-*` 정보와 [usePanelContextMenu.ts](src/components/panel/usePanelContextMenu.ts)의 처리 경로를 확인합니다.
- [syncExecution.ts](src/features/syncExecution.ts)는 상대 경로를 유지해 대상 경로를 만들고, 폴더 전체 작업에 포함되는 자식 작업을 제외합니다.

### 영속화와 복구

- 설정, 패널, 크기 캐시 등 상태를 바꿀 때는 해당 store의 저장 형식·복원·이전 버전 데이터 처리도 확인합니다.
- 디렉터리 크기에는 추정·부분·정확·오래된 값의 구분이 있습니다. CloudStorage 등에서 자동 정확 계산을 제한하는 기존 처리를 유지합니다.
- 창 상태는 Tauri window-state 플러그인이 복원합니다. macOS 잠자기 후 렌더러 복구는 [useRendererRecovery.ts](src/hooks/useRendererRecovery.ts)가 담당합니다. 시간 설정은 문서에 복제하지 않고 코드 상수를 확인합니다.

기능을 바꿀 때는 해당 설계나 연결 관계가 바뀌는 경우에만 이 문서를 갱신합니다. 매번 바뀌는 작업 목록과 검사 결과는 `TASKS.md`에 기록합니다.
