# MyCommander - AGENTS.md

This file applies to the entire repository.

## Role Of This File

- `CLAUDE.md` is the project context document.
- This file is the agent operating guide: how to work, validate, and avoid repository-specific mistakes.
- Keep the two files separate:
  - Put project facts, architecture, and layout in `CLAUDE.md`
  - Put agent workflow, guardrails, and validation rules in `AGENTS.md`

## Required First Steps

- Read [`CLAUDE.md`](/Users/sungback/Documents/MyCommander/CLAUDE.md) before making project-level assumptions.
- Before answering codebase questions or making architectural assumptions, run:
  - `mindvault query "<question>" --global`
- Use raw file reads only when MindVault returns no useful context.

## Working Style

- Keep changes focused and local to the feature or bug being addressed.
- Prefer matching the existing code style and file placement instead of introducing new patterns.
- Use Tailwind utility classes for styling in the frontend.
- Use Zustand for shared frontend state.
- Add new Tauri commands under `src-tauri/src/commands/` and register them in `src-tauri/src/lib.rs`.
- If backend behavior needs new capabilities, update the relevant files in `src-tauri/permissions/` and verify related Tauri config.
- Treat this repo as Tauri v2 only; do not apply Tauri v1 conventions without verification.
- Do not duplicate stable project background here if it already lives in `CLAUDE.md`; link to it instead.

## Validation

- Frontend/type changes:
  - `./node_modules/.bin/tsc --noEmit`
  - `npm run test`
- Rust/Tauri changes:
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `npm run test:rust`
- Full frontend production build when appropriate:
  - `npm run build`
- Full app/manual development run when needed:
  - `npm run tauri dev`

Run the smallest relevant checks for the files you touched, then mention what you ran and what you could not run.

## Commit and Build Hygiene

- Write commit messages in English.
- Do not commit build outputs such as `dist/` or `src-tauri/target/`.
- `src-tauri/target/` can become very large; use `cargo clean --manifest-path src-tauri/Cargo.toml` only when cleanup is actually needed.
- Be careful in dirty working trees and do not revert unrelated user changes.

## Troubleshooting Notes

- Development server URL is typically `http://127.0.0.1:1420`.
- If port `1420` is stuck, use `lsof -ti tcp:1420 | xargs kill`.
- If Tauri permission issues occur, inspect both `src-tauri/permissions/` and `src-tauri/tauri.conf.json`.
- If builds fail unexpectedly, check `build_log.txt` in the repo root.
- `.omc/` and `.omx/` are tool/config directories and should not be edited unless the task explicitly requires it.
