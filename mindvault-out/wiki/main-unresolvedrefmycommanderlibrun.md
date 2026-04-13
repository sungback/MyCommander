# main & __unresolved__::ref::my_commander_lib__run
Cohesion: 0.67 | Nodes: 3

## Key Nodes
- **main** (/Users/sungback/Documents/MyCommander/src-tauri/src/main.rs) -- 2 connections
  - -> calls -> [[unresolvedrefmycommanderlibrun]]
  - <- contains <- [[main]]
- **__unresolved__::ref::my_commander_lib__run** () -- 1 connections
  - <- calls <- [[main]]
- **main** (/Users/sungback/Documents/MyCommander/src-tauri/src/main.rs) -- 1 connections
  - -> contains -> [[main]]

## Internal Relationships
- main -> calls -> __unresolved__::ref::my_commander_lib__run [EXTRACTED]
- main -> contains -> main [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 main, __unresolved__::ref::my_commander_lib__run, main를 중심으로 calls 관계로 연결되어 있다. 주요 소스 파일은 main.rs이다.

### Key Facts
- fn main() { my_commander_lib::run() }
