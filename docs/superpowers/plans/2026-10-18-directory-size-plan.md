# MyCommander 폴더 용량 계산 개선 계획

- 작성일: 2026-10-18
- 기준 커밋: `a5839fa` (1.2.55)
- 대상 코드
  - Rust: `src-tauri/src/commands/fs/metadata/dir_size/` (`compute.rs`, `scan.rs`, `shared_scan.rs`, `mod.rs`, `types.rs`), `metadata/size_cache.rs`
  - Frontend: `src/components/panel/size/`, `src/hooks/manualDirectorySizeScan.ts`, `src/store/panelStoreFile*.ts`
- 원칙: 일반적인 설계 원칙만 적용한다.
  - 계산 전에 캐시를 확인하고, 취소된 결과는 저장하지 않는다.
  - 항목마다 작업을 만들어 동시 실행 수를 제한한 큐에서 처리한다.
  - 권한이 필요한 계산은 별도 경로로 분리한다.
  - 속도 개선은 측정으로 효과를 확인한 것만 채택한다.

## 유지할 기존 동작
- 하드링크는 `(dev, ino)` 기준으로 한 번만 집계한다.
- sparse 파일 보정(`counted_file_size`): 1GiB 이상이면서 실제 할당이 절반 미만인 파일만 할당 크기로 센다.
- 심볼릭 링크와 Windows reparse point는 따라가지 않는다.
- `AtomicBool`로 취소하고, 진행 이벤트는 200ms 또는 256개 단위로 보낸다.
- 추정 모드(`estimate_path_size`)와 JSON 영속 캐시(최대 10,000개, TTL: exact·limited 7일, estimated·partial 1일)

## 0단계: 측정 기준 만들기
- [x] 고정된 테스트 폴더 세트 준비: 작은 파일이 많은 폴더, `~/Library`, 하드링크가 많은 폴더, sparse 파일, `.app`, 네트워크 볼륨
  - 생성기 `dir_size/bench.rs`의 `generate`가 항상 같은 내용을 만든다(작은 파일 2만 개, 8 MiB 파일의 하드링크 500개, 4 GiB·512 MiB sparse 파일). 저장소 밖에 만든다.
  - 네트워크 볼륨은 마운트된 것이 없어 측정하지 못했다.
- [ ] `#[ignore]` 벤치 테스트로 시간과 결과값 기록. 디스크 캐시가 데워진 상태와 식은 상태(`sudo purge`)를 구분
  - warm 측정 완료(아래 기록). cold는 비밀번호가 필요한 `sudo purge` 때문에 사용자가 직접 실행해야 해서 보류.
- [x] 정확도 기준값으로 `du -skx`(할당 크기)와 `du -sAkx`(겉보기 크기)를 함께 기록(`-x`는 스캐너의 볼륨 경계와 맞추기 위함)
- [x] 1단계에서 `.app`의 `du` 분기를 없앤 뒤 큰 `.app`의 계산 시간 확인: warm 기준 Xcode.app 스캐너 0.89초, `du -skx` 0.86초로 차이 없음. cold는 보류.

### 0단계 측정 기록 (2026-10-18, warm)
- 환경: Mac16,10, macOS 27.0.1, release 빌드, 터미널에 전체 디스크 접근 권한 있음(`~/Library`에서 권한 오류 0건). 앱 번들의 권한과는 다를 수 있다.
- 방법: 방법마다 예열 1회 후 3회를 번갈아 실행한 시간 중앙값.
- 실행 방법은 `dir_size/bench.rs` 모듈 주석 참고.

| 대상 | 스캐너 | `du -skx` (할당) | `du -sAkx` (겉보기) | 항목 수 | 시간 (스캐너 / du) |
|---|---:|---:|---:|---:|---|
| 작은 파일 2만 개 | 40.9 MB | 81.9 MB | 46.7 MB | 20,100 | 0.04s / 0.04s |
| 하드링크 500개 | 8.4 MB | 8.4 MB | 8.4 MB | 511 | 0.00s / 0.00s |
| sparse 4 GiB | 0 | 0 | 4.29 GB | 1 | - |
| sparse 512 MiB | 536.9 MB | 0 | 536.9 MB | 1 | - |
| Xcode.app | 10.24 GB | 4.17 GB | 10.29 GB | 166,835 | 0.89s / 0.86s |
| Cursor.app | 972.7 MB | 1.02 GB | 980.1 MB | 22,627 | 0.11s / 0.11s |
| `~/Library` | 61.74 GB | 47.16 GB | 8.86 TB | 307,801 | 7.95s / 7.92s |

관찰:
- 속도: warm에서는 단일 스레드 스캐너와 `du`가 같은 속도다. 둘 다 항목당 메타데이터 조회가 병목으로 보인다(초당 약 3만 8천 항목). 2단계의 병렬 순회·`getattrlistbulk` 효과는 이 기준과 cold 수치로 판단한다.
- 하드링크와 볼륨 경계: `du`와 결과가 같다.
- sparse 파일: 1 GiB 이상은 보정이 동작한다(`~/Library`의 sparse 파일 2개, 약 8 TiB). 1 GiB 미만은 실제 데이터에서 99개, 0.02 GiB뿐이라 "1단계 후속 과제"의 우선순위는 낮다.
- 겉보기 크기와 할당 크기 차이의 원인(Python으로 `st_flags`·`st_blocks` 분해, 읽기 전용):
  - 작은 파일: 할당 크기가 최소 4 KB 블록 단위라 겉보기의 약 2배.
  - APFS 압축 파일: Xcode.app은 압축 파일 26,564개에서 5.88 GiB 차이. 1단계 이전 `.app`은 `du`로 4.2 GB를 표시했고, 지금은 10.2 GB를 표시한다.
  - 클라우드 온라인 전용(dataless) 파일: `~/Library/CloudStorage`의 51,411개, 13.48 GiB는 디스크에 없지만 겉보기 크기로 집계된다.
- 결정(2026-10-18): 크기 기준은 겉보기 크기로 유지한다(sparse 파일만 할당 크기). 위 세 경우는 겉보기 크기가 디스크 사용량보다 크거나 작게 보이는 알려진 차이로 둔다.

### cold 측정 방법 (사용자 실행 필요)
- `sudo purge`에 비밀번호가 필요해 에이전트가 실행할 수 없다. 저장소 루트에서 아래를 실행하고 출력된 표 행을 이 기록에 추가한다.
- 방법마다 바로 앞에서 `sudo purge`로 캐시를 비운다. cold에서 `du`는 `du -skx`만 잰다.

```sh
for P in /Applications/Xcode.app "$HOME/Library"; do
  for M in scanner du; do
    sudo purge
    MYCOMMANDER_SIZE_BENCH_MODE=cold MYCOMMANDER_SIZE_BENCH_METHOD=$M MYCOMMANDER_SIZE_BENCH_PATHS="$P" \
      cargo test --release --lib --manifest-path src-tauri/Cargo.toml dir_size::bench::measure -- --ignored --nocapture 2>&1 | grep '^| `'
  done
done
```

## 1단계: 안정성 (새 의존성 없음) — 2026-10-18 완료
- [x] 크기 기준 통일: `.app`만 `du -sk`(KB 단위로 반올림된 할당 크기)를 쓰던 분기를 없애고 모든 폴더가 같은 스캐너를 쓴다. 이제 `.app` 계산도 취소할 수 있다.
  - 기준은 겉보기 크기이고, sparse 파일만 할당 크기로 센다. `counted_file_size` 문서 주석에 적었다.
  - `SizeMode::Apparent` / `SizeMode::OnDisk` enum은 만들지 않았다. 쓰지 않는 `OnDisk` 변형이 clippy `dead_code` 경고에 걸리기 때문이다. 할당 크기 기준이 실제로 필요해지면 그때 추가한다.
- [x] 접근 불가 항목: 권한 오류를 `inaccessible_count`로 따로 세고, 새 크기 상태 `limited`로 패널에 "≥"를 표시한다.
  - `limited`는 exact와 같은 TTL·재검증 규칙을 따른다. 세션당 한 번만 다시 계산한다.
  - 권한 오류를 partial로 되돌리지 않았다. 커밋 `29185b5`에서 Windows `C:\Users`의 "+"가 풀리지 않는 문제 때문에 일부러 뺀 동작이다.
- [x] 볼륨 경계: 루트의 `dev`와 다른 디렉터리로는 내려가지 않는다(`du -x`와 같은 기준, partial로 표시하지 않음).
  - 정확 계산과 추정에 모두 적용한다. Windows는 볼륨 경계가 reparse point로 드러나 이미 따라가지 않으므로 바꾸지 않았다.
- [x] `compute_path_size`를 `symlink_metadata` 기준으로 맞췄다. 심볼릭 링크 자체는 크기 0이고, 대상이 없는 링크도 오류 대신 0을 돌려준다.
- [x] 같은 경로의 동시 계산 공유(`shared_scan.rs`): 진행 중인 계산을 `scan_id`가 아니라 경로 기준으로 공유한다.
  - 마지막 요청자가 취소할 때만 계산을 멈추고, 진행 이벤트는 모든 요청자의 `scan_id`로 보낸다.
  - 결과에 실제 시작 시각(`started_at_ms`)을 담는다. 계산 도중에 합류한 요청이 자기 요청 시각을 기준으로 삼아, 그 사이의 파일 변경을 놓치지 않게 하기 위해서다.
- [x] 각 항목에 회귀 테스트를 추가했다(Rust 12개, 프런트엔드 8개).

### 1단계 후속 과제
- [ ] 정보 다이얼로그(`useDialogInfo` → `get_dir_size`)는 크기 숫자만 받으므로, 접근 불가 항목이 있어도 exact로 저장한다. `get_dir_size`가 `inaccessible_count`도 돌려주게 바꾼다(IPC 반환 형식 변경).
- [ ] 1GiB 미만 sparse 파일은 겉보기 크기로 센다. 0단계 측정에서 차이가 크게 나오면 기준을 다시 정한다.

## 2단계: 속도 (측정으로 효과를 확인한 것만 채택)
- [ ] 병렬 순회: 전용 `rayon::ThreadPool`(스레드 4~8개). `sysinfo`가 쓰는 전역 풀과 분리한다.
  - 하드링크: 각 스레드가 `nlink > 1`인 파일의 `(dev, ino, size)`만 따로 모으고, 마지막에 합쳐서 한 번만 더한다.
  - 네트워크 파일시스템(`statfs`의 `f_fstypename`이 smbfs, nfs, webdav, afpfs 등)에서는 단일 스레드로 돌린다.
- [ ] macOS `getattrlistbulk`로 디렉터리 단위 일괄 조회(이름, 종류, 크기, 할당 크기, 링크 수, 파일 ID).
  - `cfg(target_os = "macos")` 모듈에 `unsafe` 코드를 격리하고, `std::fs` 구현을 대체 경로로 유지한다.
  - 두 구현의 결과가 같은지 비교하는 테스트를 붙인다.

## 3단계: 캐시
- [ ] 스캔하면서 모든 하위 디렉터리의 결과를 메모리에 기록한다. 부모 계산 때 재사용하고, 하위 폴더로 들어갔을 때 바로 표시한다. 디스크에는 상위 N개만 저장한다.
- [ ] 파일 변경 이벤트로 변경된 경로와 그 상위 경로 전체를 무효화한다. TTL은 보조 수단으로 남긴다.
  - 현재: 패널에 열린 경로는 `notify` 재귀 감시로 변경을 받아, 변경된 경로와 상위 경로를 stale 처리한다(`panelRefresh.ts` → `markEntrySizesStale`).
  - 남은 범위: 패널에 열려 있지 않은 경로의 캐시값. 위 메모리 캐시를 도입할 때 함께 다룬다.
  - 디렉터리 mtime은 바로 아래 항목이 바뀔 때만 갱신되므로, 루트 mtime만으로 하위 트리가 그대로인지 판단하지 않는다.

## 의존성 (추가 전 사용자 승인 필요, 2026-10-18 기준 보류)
- `rayon = "1.11"`: `sysinfo 0.33.1`을 통해 1.11.0이 이미 `Cargo.lock`에 있다.
- `[target.'cfg(target_os = "macos")'.dependencies] libc = "0.2.183"`: `Cargo.lock`에서 69개 패키지가 이미 쓰고 있고, 0.2.183 소스(`src/unix/bsd/apple/mod.rs`)에 `getattrlistbulk` 정의가 있다.
- 두 크레이트 모두 새로 내려받을 것은 없다.

## 완료 후 정리
- 오래 유지할 설계 사실(크기 기준, `limited` 상태, 볼륨 경계, 경로 기준 계산 공유)은 `CLAUDE.md`의 "비명시적 동작"으로 옮긴다.
- 크기 표시 기호("≥", "+", "~")의 의미는 `README.md`에 사용자 설명으로 옮긴다.
- 이 문서는 남은 항목이 없으면 기록용으로 두거나 삭제한다.
