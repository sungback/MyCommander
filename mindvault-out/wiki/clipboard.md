# clipboard
Cohesion: 1.00 | Nodes: 1

## Key Nodes
- **clipboard** (/Users/sungback/Documents/MyCommander/src/utils/clipboard.ts) -- 0 connections

## Internal Relationships

## Cross-Community Connections

## Context
이 커뮤니티는 clipboard를 중심으로 related 관계로 연결되어 있다. 주요 소스 파일은 clipboard.ts이다.

### Key Facts
- export async function writeClipboardText(text: string): Promise<void> { if ( typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function" ) { try { await navigator.clipboard.writeText(text); return; } catch (error) {…
