# vite.config & __unresolved__::ref::__vitejs_plugin_react_
Cohesion: 0.33 | Nodes: 6

## Key Nodes
- **vite.config** (/Users/sungback/Documents/MyCommander/vite.config.ts) -- 3 connections
  - -> imports -> [[unresolvedrefvite]]
  - -> imports -> [[unresolvedrefvitejspluginreact]]
  - -> imports -> [[unresolvedreftailwindcssvite]]
- **__unresolved__::ref::__vitejs_plugin_react_** () -- 2 connections
  - <- imports <- [[viteconfig]]
  - <- imports <- [[vitestconfig]]
- **vitest.config** (/Users/sungback/Documents/MyCommander/vitest.config.ts) -- 2 connections
  - -> imports -> [[unresolvedrefvitestconfig]]
  - -> imports -> [[unresolvedrefvitejspluginreact]]
- **__unresolved__::ref::__tailwindcss_vite_** () -- 1 connections
  - <- imports <- [[viteconfig]]
- **__unresolved__::ref::_vite_** () -- 1 connections
  - <- imports <- [[viteconfig]]
- **__unresolved__::ref::_vitest_config_** () -- 1 connections
  - <- imports <- [[vitestconfig]]

## Internal Relationships
- vite.config -> imports -> __unresolved__::ref::_vite_ [EXTRACTED]
- vite.config -> imports -> __unresolved__::ref::__vitejs_plugin_react_ [EXTRACTED]
- vite.config -> imports -> __unresolved__::ref::__tailwindcss_vite_ [EXTRACTED]
- vitest.config -> imports -> __unresolved__::ref::_vitest_config_ [EXTRACTED]
- vitest.config -> imports -> __unresolved__::ref::__vitejs_plugin_react_ [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 vite.config, __unresolved__::ref::__vitejs_plugin_react_, vitest.config를 중심으로 imports 관계로 연결되어 있다. 주요 소스 파일은 vite.config.ts, vitest.config.ts이다.

### Key Facts
- export default defineConfig({ plugins: [react()], test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], coverage: { provider: 'v8', reporter: ['text', 'html'], exclude: [ 'node_modules/**', 'src-tauri/**', 'dist/**', 'src/test/**', '**/*.d.ts', 'vite.config.ts',…
