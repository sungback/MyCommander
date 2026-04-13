# bash & MyCommander 🚀
Cohesion: 0.48 | Nodes: 7

## Key Nodes
- **bash** (/Users/sungback/Documents/MyCommander/README.md) -- 5 connections
  - <- has_code_example <- [[quick-start]]
  - <- has_code_example <- [[commands]]
  - <- has_code_example <- [[git]]
  - <- has_code_example <- [[release]]
  - <- has_code_example <- [[troubleshooting]]
- **MyCommander 🚀** (/Users/sungback/Documents/MyCommander/README.md) -- 5 connections
  - -> contains -> [[quick-start]]
  - -> contains -> [[commands]]
  - -> contains -> [[git]]
  - -> contains -> [[release]]
  - -> contains -> [[troubleshooting]]
- **⌨️ 명령어 요약 (Commands)** (/Users/sungback/Documents/MyCommander/README.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander]]
- **🤝 코드 기여 워크플로우 (Git)** (/Users/sungback/Documents/MyCommander/README.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander]]
- **📦 빠른 시작 (Quick Start)** (/Users/sungback/Documents/MyCommander/README.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander]]
- **🔖 버전 업데이트 (Release)** (/Users/sungback/Documents/MyCommander/README.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander]]
- **🚑 문제 해결 (Troubleshooting)** (/Users/sungback/Documents/MyCommander/README.md) -- 2 connections
  - -> has_code_example -> [[bash]]
  - <- contains <- [[mycommander]]

## Internal Relationships
- ⌨️ 명령어 요약 (Commands) -> has_code_example -> bash [EXTRACTED]
- 🤝 코드 기여 워크플로우 (Git) -> has_code_example -> bash [EXTRACTED]
- MyCommander 🚀 -> contains -> 📦 빠른 시작 (Quick Start) [EXTRACTED]
- MyCommander 🚀 -> contains -> ⌨️ 명령어 요약 (Commands) [EXTRACTED]
- MyCommander 🚀 -> contains -> 🤝 코드 기여 워크플로우 (Git) [EXTRACTED]
- MyCommander 🚀 -> contains -> 🔖 버전 업데이트 (Release) [EXTRACTED]
- MyCommander 🚀 -> contains -> 🚑 문제 해결 (Troubleshooting) [EXTRACTED]
- 📦 빠른 시작 (Quick Start) -> has_code_example -> bash [EXTRACTED]
- 🔖 버전 업데이트 (Release) -> has_code_example -> bash [EXTRACTED]
- 🚑 문제 해결 (Troubleshooting) -> has_code_example -> bash [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 bash, MyCommander 🚀, ⌨️ 명령어 요약 (Commands)를 중심으로 has_code_example 관계로 연결되어 있다. 주요 소스 파일은 README.md이다.

### Key Facts
- ```bash npm install cd src-tauri && cargo check && cd .. ```
- MyCommander는 Tauri + React + TypeScript로 만들어진 초고속 데스크톱 파일 매니저입니다.
- | 용도 | 명령어 | 비고 | |---|---|---| | 앱 전체 개발 모드 | `npm run tauri dev` | 프론트엔드(포트 `1420`)와 백엔드를 동시 시작 | | 프론트엔드만 실행 | `npm run dev` | UI 디자인 껍데기만 수정하고 싶을 때 유용함 | | 타입스크립트 검사 | `npm run typecheck` | (또는 `./node_modules/.bin/tsc --noEmit`) | | 백엔드 문법 검사 | `cargo check` | 반드시 `src-tauri` 폴더 안에 들어가서 실행 필요…
- 협업이나 로컬 코드 관리를 위한 가장 기본적이고 안전한 작업 순서 요약입니다.
- **1. 패키지 설치 및 Rust 빌드 점검**
