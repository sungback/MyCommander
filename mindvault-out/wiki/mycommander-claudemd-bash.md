# MyCommander — CLAUDE.md & bash
Cohesion: 0.67 | Nodes: 4

## Key Nodes
- **MyCommander — CLAUDE.md** (/Users/sungback/Documents/MyCommander/CLAUDE.md) -- 3 connections
  - -> has_code_example -> [[bash]]
  - -> contains -> [[frontend-typescript-react]]
  - -> contains -> [[backend-rust-tauri]]
- **bash** (/Users/sungback/Documents/MyCommander/CLAUDE.md) -- 2 connections
  - <- has_code_example <- [[mycommander-claudemd]]
  - <- has_code_example <- [[backend-rust-tauri]]
- **Backend (Rust / Tauri)** (/Users/sungback/Documents/MyCommander/CLAUDE.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander-claudemd]]
- **Frontend (TypeScript / React)** (/Users/sungback/Documents/MyCommander/CLAUDE.md) -- 1 connections
  - <- contains <- [[mycommander-claudemd]]

## Internal Relationships
- Backend (Rust / Tauri) -> has_code_example -> bash [EXTRACTED]
- MyCommander — CLAUDE.md -> has_code_example -> bash [EXTRACTED]
- MyCommander — CLAUDE.md -> contains -> Frontend (TypeScript / React) [EXTRACTED]
- MyCommander — CLAUDE.md -> contains -> Backend (Rust / Tauri) [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 MyCommander — CLAUDE.md, bash, Backend (Rust / Tauri)를 중심으로 has_code_example 관계로 연결되어 있다. 주요 소스 파일은 CLAUDE.md이다.

### Key Facts
- 이 파일은 Claude가 이 프로젝트를 이해하고 작업할 때 참고하는 컨텍스트 문서입니다.
- ```bash Tauri 데스크톱 앱 실행 (개발) npm run tauri dev
- - Tauri 커스텀 커맨드는 `src-tauri/src/commands/`에 추가 - 커맨드 추가 후 `lib.rs`의 `invoke_handler`에 등록 필요 - 권한은 `src-tauri/permissions/`에서 관리 - `tauri.conf.json`에서 앱 설정 및 번들 타겟 관리
- - 컴포넌트는 `src/components/` 아래에 기능별로 분리 - 전역 상태는 Zustand (`src/store/`) 사용 - 타입 정의는 `src/types/`에 모음 - 유틸 함수는 `src/utils/`에 모음 - 스타일은 Tailwind CSS v4 사용 (인라인 클래스 방식) - 아이콘은 `lucide-react` 사용 - 긴 목록은 `@tanstack/react-virtual`로 가상화
