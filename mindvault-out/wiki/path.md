# path
Cohesion: 1.00 | Nodes: 1

## Key Nodes
- **path** (/Users/sungback/Documents/MyCommander/src/utils/path.ts) -- 0 connections

## Internal Relationships

## Cross-Community Connections

## Context
이 커뮤니티는 path를 중심으로 related 관계로 연결되어 있다. 주요 소스 파일은 path.ts이다.

### Key Facts
- export function joinPath(base: string, child: string): string { // Simple check for Windows vs Unix paths const isWindows = base.includes("\\") || /^[A-Z]:/i.test(base); const sep = isWindows ? "\\" : "/"; if (base.endsWith(sep)) { return base + child; } return base + sep + child; }
