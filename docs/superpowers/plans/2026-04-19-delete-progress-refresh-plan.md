# Delete Progress And Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show clear progress while deleting large folders and ensure deleted folders disappear from the panel immediately and reliably after completion.

**Architecture:** Extend the existing `fs-progress` event flow so delete operations use the same progress dialog pattern already used by copy/move/zip. Fix the post-delete refresh path by refreshing from the deleted entries' parent directories and covering the watcher/refresh edge case with focused tests.

**Tech Stack:** Tauri v2, Rust commands, React 19, TypeScript, Zustand, Vitest, cargo test

---

### Task 1: Reproduce The Missing Delete Feedback In Tests

**Files:**
- Modify: `src/components/dialogs/DialogContainer.tsx`
- Test: `src/components/dialogs/DialogContainer.test.tsx` or add `src/components/dialogs/DialogContainer.delete.test.tsx`

- [ ] **Step 1: Write a failing test for delete opening the progress dialog**

Add a test that triggers the delete confirm flow for a directory selection and expects `setOpenDialog("progress")` before `deleteFiles` resolves.

- [ ] **Step 2: Run the targeted frontend test to verify it fails**

Run: `npm run test -- DialogContainer`
Expected: FAIL because delete currently closes the confirm dialog and performs deletion without opening progress UI.

- [ ] **Step 3: Add a second failing test for refreshing deleted parents**

Add a test that deletes entries under a panel path and expects the refresh helper to be called with the deleted entries' parent directories, not only the active panel path.

- [ ] **Step 4: Run the targeted frontend test again**

Run: `npm run test -- DialogContainer`
Expected: FAIL because delete currently refreshes only `getPanelAccessPath(activePanel)`.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/components/dialogs/DialogContainer*.tsx
git commit -m "test: cover delete progress and refresh behavior"
```

### Task 2: Add Delete Progress Emission In Rust

**Files:**
- Modify: `src-tauri/src/commands/fs_commands.rs`
- Test: `src-tauri/src/commands/fs_commands.rs`

- [ ] **Step 1: Write a failing Rust test for delete progress bookkeeping**

Add a small pure-function test around delete progress preparation, such as counting deletable items/directories or building the delete work list from nested paths.

- [ ] **Step 2: Run the targeted Rust test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml delete_`
Expected: FAIL because no delete progress helper exists yet.

- [ ] **Step 3: Implement minimal delete progress helpers**

In `fs_commands.rs`, add helper logic to:
- collapse nested selected paths once
- compute a progress total that makes sense for large deletes
- emit `fs-progress` payloads with `operation: "delete"`

Keep the implementation close to the existing copy/move/zip progress payload format.

- [ ] **Step 4: Update `delete_files` to use the helpers**

Wrap deletion in `spawn_blocking`, emit initial progress, emit per-item progress as each top-level target is deleted or moved to trash, and return only after the work completes.

- [ ] **Step 5: Run the targeted Rust test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml delete_`
Expected: PASS

- [ ] **Step 6: Commit the Rust progress work**

```bash
git add src-tauri/src/commands/fs_commands.rs
git commit -m "feat: emit progress for delete operations"
```

### Task 3: Teach The Progress Dialog About Delete Operations

**Files:**
- Modify: `src/components/dialogs/ProgressDialog.tsx`
- Test: `src/components/dialogs/ProgressDialog.test.tsx` or existing dialog tests

- [ ] **Step 1: Write a failing test for delete labels and percentages**

Add a test that feeds an `fs-progress` event with `operation: "delete"` and expects:
- title like `Deleting Files...`
- item counter text
- percentage rendering

- [ ] **Step 2: Run the targeted dialog test to verify it fails**

Run: `npm run test -- ProgressDialog`
Expected: FAIL because the dialog currently only labels copy/move/zip.

- [ ] **Step 3: Implement minimal UI support for delete progress**

Update the progress payload type and label mapping in `ProgressDialog.tsx` so delete reuses the existing bar, percent, and current-file text without introducing a second dialog.

- [ ] **Step 4: Run the targeted dialog test to verify it passes**

Run: `npm run test -- ProgressDialog`
Expected: PASS

- [ ] **Step 5: Commit the dialog update**

```bash
git add src/components/dialogs/ProgressDialog.tsx src/components/dialogs/ProgressDialog*.test.tsx
git commit -m "feat: show delete progress in progress dialog"
```

### Task 4: Fix Post-Delete Refresh Reliability

**Files:**
- Modify: `src/components/dialogs/DialogContainer.tsx`
- Modify: `src/store/panelRefresh.ts`
- Test: `src/store/panelRefresh.test.ts`
- Test: `src/components/dialogs/DialogContainer*.test.tsx`

- [ ] **Step 1: Implement minimal delete refresh logic**

After delete succeeds:
- derive parent directories from `selectedPaths`
- refresh affected panels via `refreshPanelsForEntryPaths(selectedPaths)` or equivalent parent-directory refresh
- clear stale selection if needed before closing the dialog

- [ ] **Step 2: Keep same-directory dual-panel refresh behavior**

Verify the helper still refreshes both panels when both are viewing the same directory or when `resolvedPath` differs from `currentPath`.

- [ ] **Step 3: Add or update tests for resolved/display path refresh**

Cover at least:
- normal folder delete in active panel
- same folder open on both panels
- resolved path differs from display path (CloudStorage-style path)

- [ ] **Step 4: Run the targeted frontend tests**

Run: `npm run test -- panelRefresh`
Run: `npm run test -- DialogContainer`
Expected: PASS

- [ ] **Step 5: Commit the refresh fix**

```bash
git add src/components/dialogs/DialogContainer.tsx src/store/panelRefresh.ts src/store/panelRefresh.test.ts src/components/dialogs/DialogContainer*.test.tsx
git commit -m "fix: refresh panels after delete"
```

### Task 5: Verify End-To-End Delete Behavior

**Files:**
- Modify: `src/hooks/useFileSystem.test.ts` if payload or command contract changes
- Optional: `src/test/mocks/tauri.ts`

- [ ] **Step 1: Update command-layer tests if delete invocation shape changes**

If `delete_files` gains progress-related behavior without changing the frontend invoke shape, keep this minimal. Only update mocks/types where required.

- [ ] **Step 2: Run the smallest required verification set**

Run: `npm run test -- ProgressDialog`
Run: `npm run test -- DialogContainer`
Run: `npm run test -- panelRefresh`
Run: `cargo test --manifest-path src-tauri/Cargo.toml delete_`
Expected: PASS

- [ ] **Step 3: Run repository-level verification for touched areas**

Run: `./node_modules/.bin/tsc --noEmit`
Run: `npm run test`
Run: `npm run test:rust`
Expected: PASS

- [ ] **Step 4: Manual smoke-check in the app**

Run: `npm run tauri dev`
Verify:
- deleting a large folder opens progress UI with percent/item feedback
- progress dialog closes when done
- deleted folder disappears from the current panel
- same directory open on the opposite panel also refreshes
- CloudStorage/symlink display path still refreshes correctly

- [ ] **Step 5: Commit final verification-safe cleanup**

```bash
git add src src-tauri
git commit -m "feat: improve delete progress and refresh behavior"
```
