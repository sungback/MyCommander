# format & __unresolved__::ref::_date_fns_
Cohesion: 0.67 | Nodes: 3

## Key Nodes
- **format** (/Users/sungback/Documents/MyCommander/src/utils/format.ts) -- 2 connections
  - -> contains -> [[formatsizeoptions]]
  - -> imports -> [[unresolvedrefdatefns]]
- **__unresolved__::ref::_date_fns_** () -- 1 connections
  - <- imports <- [[format]]
- **FormatSizeOptions** (/Users/sungback/Documents/MyCommander/src/utils/format.ts) -- 1 connections
  - <- contains <- [[format]]

## Internal Relationships
- format -> contains -> FormatSizeOptions [EXTRACTED]
- format -> imports -> __unresolved__::ref::_date_fns_ [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 format, __unresolved__::ref::_date_fns_, FormatSizeOptions를 중심으로 contains 관계로 연결되어 있다. 주요 소스 파일은 format.ts이다.

### Key Facts
- import { format } from "date-fns";
- interface FormatSizeOptions { base?: 1000 | 1024; }
