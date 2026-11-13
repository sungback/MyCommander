# MyCommander — 작업 인계

최종 갱신: 2026-11-13

재개할 때 이 파일과 `git status --short`를 먼저 확인합니다. 아래 검사는 실행 당시의 결과이므로 코드가 바뀌었다면 영향 범위에 맞게 다시 확인합니다. 지난 상세 내역은 Git 이력을 봅니다.

## 현재 상태

- 최신 릴리즈: `v1.2.82`(`7c2d9bf`, Shift+F8 영구 삭제 포함). 아래 검증 기록(`verify:release` 통과, GitHub 릴리즈 워크플로 성공, 산출물 8개)은 v1.2.76~v1.2.78 기준이며 v1.2.79~v1.2.82는 이 파일에 기록하지 않았습니다.
- v1.2.77(`ce6a94b`): Tab으로 패널을 전환하면 새 활성 패널의 파일 목록으로 DOM 포커스를 옮깁니다(대화상자가 열려 있으면 제외). Filter 입력창이 포커스를 받던 원인은 코드에서 확정하지 못했습니다.
- 리팩토링(`241eb4f`, main에 푸시, 릴리즈 없음): `panelStoreFileActions.ts`의 크기 캐시 액션 8개를 `panelStoreSizeActions.ts`로 옮겼습니다(본문 `diff` 동일). 먼저 동작 고정 테스트 16개(`panelStore.size-actions.test.ts`, `2740636`)를 추가했고 일부러 코드를 망가뜨려 테스트가 잡는 것을 확인했습니다. `verify:frontend` 통과. 푸시 후 GitHub CI는 `241eb4f`에서 `test` 잡이 실패했고(`QuickPreviewPptxView.test.tsx`의 "releases thumbnail documents that scroll out of the list", `getByTitle("2번 슬라이드 썸네일")`을 찾지 못함), 같은 코드를 담은 다음 커밋 `39ed9ef`의 CI는 성공했습니다. 로컬에서 6번 반복 실행은 모두 통과했습니다. 이번 변경(스토어)과 무관한 기존 flaky 테스트로 판단했습니다. 실패 시점 DOM에 슬라이드 버튼은 있고 썸네일 iframe은 없었으므로, `useEffect`의 `IntersectionObserver` 등록 전에 테스트가 `setVisible`을 호출한 경합으로 추정하고 `d71803f`에서 등록을 `waitFor`로 기다리게 고쳤습니다. 실패를 재현하지는 못해서 효과는 입증되지 않았고, `d71803f`의 CI는 성공했지만 한 번의 성공입니다. 이후 CI에서 같은 테스트가 다시 실패하면 재조사합니다. Rust 검사는 이번 변경과 무관해 돌리지 않았습니다.
- 브랜치 정리(2026-11-03): 작업 브랜치 `release-1.2.75`와 로컬 `main`을 `origin/main`(`d71803f`)에 맞췄습니다. 옛 로컬 `main`의 커밋 3개(`4ccd973`·`c9af404`·`081354a`)는 `git cherry`로 원격에 같은 변경이 있음을 확인했고, 옛 끝점 `081354a`는 reflog에 있습니다.
- v1.2.78(`4d4f4ef`): 활성 패널의 커서 행을 강조색 배경·테두리로 표시합니다(`FileItem.tsx`). 사용자가 Windows 앱에서 구분이 잘 된다고 확인했습니다. 다른 두 테마의 대비는 미확인입니다.
- 새 앱 아이콘(`d888e90`, v1.2.76에 포함): 듀얼 패널 폴더 로고. 마스터는 `src-tauri/icons/source/icon.svg`이고 `tauri icon`으로 데스크톱 아이콘을 생성했습니다(Android·iOS 출력은 제거). Windows 탐색기·작업 표시줄·바로가기에서 새 로고를 사용자가 확인했습니다. 옛 아이콘이 보이면 Windows 아이콘 캐시나 바로가기 설정 문제였습니다.
- 테스트 불안정 수정(`407cb1f`): delete 테스트의 임시 폴더 이름이 병렬 실행에서 겹쳐 가끔 실패하던 문제로 추정해 카운터를 붙였습니다. 재현하지 못해 효과는 입증되지 않았습니다.
- CI 속도 개선(`ff5864d`)은 main에 푸시했고 CI와 첫 릴리즈 캐시 준비가 성공했습니다.
- 완료(`a76c45d`, v1.2.74에 포함): DMG 마운트 디스크를 드라이브 막대에 표시하고 ⏏ 버튼으로 추출. `eject_drive` 명령 추가(추출 가능한 드라이브만, 강제 추출 없음), 마운트·추출·창 포커스 때 목록 갱신, 추출한 볼륨 안의 패널은 홈으로 이동. 범위는 macOS.
- 검사(2026-10-30): 타입 검사, 패널 테스트 315개, Rust fmt·Clippy·`drives` 테스트 3개, Tauri 명령 50개 정합성 통과. 임시 DMG로 `diskutil eject` 동작을 터미널에서 확인했습니다.
- 실제 앱 검증(2026-11-09, 사용자 직접 확인): DMG 마운트 → 목록 표시 → ⏏ 추출 정상 동작. 사용 중인 디스크 추출 시 오류 안내는 따로 기록되지 않았습니다. 추출한 볼륨을 보던 비활성 탭은 옮기지 않습니다.

## 남은 확인

- **macOS F8 휴지통 이동**(`18d65e7`): 기본 이동 실패 시 Finder 재시도 → 권한 안내, 영구 삭제로 자동 전환하지 않습니다. 디버그 앱에서 임시 파일로 실제 F8 삭제와 Finder 권한 창을 확인해야 합니다. 릴리즈 서명 앱과 다른 OS는 미검증입니다.
- **릴리즈 캐시 효과**: 다음 릴리즈에서 main 캐시 재사용 여부와 빌드 단축 폭을 확인합니다. 지난 `v1.2.72`는 12분 27초(Windows Rust 캐시 미적중, 컴파일 8분 14초)였습니다. Rust 버전·의존성이 바뀌면 첫 준비는 다시 오래 걸립니다.
- **Windows `uninstall.exe` 아이콘**: 옛 NSIS 기본 아이콘 그대로입니다. `bundle > windows > nsis > uninstallerIcon`이 필요하지만, CLI를 2.12.4로 올려도 Rust `tauri-utils` 2.8.3이 `unknown field uninstallerIcon`으로 빌드를 거부합니다(2026-11-02 확인, 변경은 되돌림). 해결하려면 `tauri`·`tauri-build` 크레이트 업그레이드가 필요해 보류했습니다.
- **리팩토링(2026-11-13)**: 급한 구조 문제는 없습니다. 크기×변경 빈도로 6개를 봤고 `panelStoreFileActions.ts` 분리는 끝났습니다.
  - 완료(`3749b3c`, `6522a25`, 릴리즈 없음): `DialogContainer`·`CommandPalette`가 대화상자·팔레트가 닫힌 동안 패널 변경(커서 이동)으로 재렌더되지 않게 `useDialogPanels`(`components/dialogs/`)로 구독을 동결했습니다. 닫힌 상태에서 커서 20회 이동 시 `DialogContainer` 추가 렌더링이 40회에서 0회로 줄었습니다(헤드리스 Profiler 측정, 회귀 테스트 `*.render-count.test.tsx` 2개). 실제 앱·대용량 폴더에서의 체감 효과는 측정하지 않았습니다. `TransferSpaceWarningDialog`는 자체 스토어만 구독해 대상이 아닙니다. 테스트 하네스 `registerDialogContainerTestLifecycle`은 `delete` 대화상자를 열어 두므로 닫힘 상태를 측정하려면 `closeDialog()`를 먼저 호출해야 합니다.
  - 완료(`9a49157`, 릴리즈 없음): `FilePanel.tsx`의 빠른 필터 상태·효과·핸들러를 `useQuickFilter.ts`로 옮겼습니다(코드 이동만, 동작 변경 없음). 기존 `FilePanel.quick-filter` 테스트와 패널 테스트 315개가 통과했지만, 코드를 일부러 망가뜨려 테스트가 잡는지는 확인하지 않았습니다.
  - 남은 후보는 아래입니다.
  - `FileList.tsx`·`panelStore.ts`·`lib.rs`는 이미 분해되어 있어 불필요합니다. `lib.rs` 변경이 잦은 것은 명령 등록 때문입니다.
  - `panelStoreSizeActions.ts`(541줄)에 "바뀐 필드만 담는 `{...(같으면 {} : {...})}`" 패턴이 반복됩니다. 헬퍼화는 이번에 하지 않았습니다.
- **Git 훅**: pre-commit이 변경 범위와 무관하게 타입 검사와 프런트엔드 전체 테스트를 실행합니다. 변경 범위 검사로 맞추는 작업은 요청된 적이 없습니다.

## 참고한 결정

- 검사: 개발·커밋 전에는 변경 범위, 푸시·릴리즈 전에는 전체.
- 릴리즈 캐시: Rust 코드·빌드 설정이 main에 올라오면 세 운영체제에서 자동 준비하고 문서만 바꿀 때는 제외. 관련 변경이 잦으면 GitHub 실행량이 늘어납니다.
- CI 29분 지연(#116)의 원인은 Ubuntu 미러 다운로드(37.7 MB에 27분 51초)였습니다. 다운로드 시간 제한과 대체 미러 재시도로 대응했고, 정상 상태의 새 CI는 2분 15초였습니다.

## 최근 검사 (2026-10-29)

- 병합·릴리즈 상태: 프런트엔드 타입·테스트 1,271개·빌드, Rust fmt·Clippy·테스트 186개(기존 ignored 2개), Tauri 명령 49개 정합성, `npm run verify:release` 통과. 로컬 Rust는 CI와 같은 stable 1.99.1로 갱신했습니다.
- CI 개선: Linux 설치 모의 테스트 7개, ShellCheck·actionlint, `npm run verify` 통과.
