# 2026-04-22 Work Summary And Tag Push Plan

**Goal:** Capture the current worktree in one place, summarize what has already been implemented and verified, and define a safe release path from the current uncommitted state through commit, tag creation, and tag push.

**Current branch:** `main`

**Current version state:** `package.json` and `src-tauri/tauri.conf.json` are both `1.1.19`, and the latest existing Git tag is already `v1.1.19`. That means the next release tag cannot reuse the current version number. The default recommendation is to release as `v1.1.20`.

**Verification already completed on the current worktree:**
- `./node_modules/.bin/tsc --noEmit`
- `npm run test`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run test:rust`

---

## Work Summary

### 1. Job submission payload hardening

**Files:**
- [`src/hooks/useFileSystem.ts`](/Users/back/workspace/MyCommander/src/hooks/useFileSystem.ts)
- [`src/hooks/useFileSystem.test.ts`](/Users/back/workspace/MyCommander/src/hooks/useFileSystem.test.ts)
- [`src-tauri/src/commands/job_commands.rs`](/Users/back/workspace/MyCommander/src-tauri/src/commands/job_commands.rs)

**Summary:**
- Added explicit frontend marshaling from camelCase job payloads to Tauri snake_case IPC payloads.
- Added Rust-side compatibility aliases so existing or unexpected camelCase payloads still deserialize safely.
- Locked copy, move, and zip-selection job submission shapes in tests.

**User-facing impact:**
- Fixes the `submit_job` deserialization failure seen in F5 copy flows.

### 2. Copy queue message cleanup

**Files:**
- [`src/components/dialogs/DialogContainer.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/DialogContainer.tsx)
- [`src/components/dialogs/DialogContainer.test.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/DialogContainer.test.tsx)
- [`src/components/panel/FileList.tsx`](/Users/back/workspace/MyCommander/src/components/panel/FileList.tsx)
- [`src/components/panel/FileList.test.tsx`](/Users/back/workspace/MyCommander/src/components/panel/FileList.test.tsx)

**Summary:**
- Removed the copy-success status message from F5 copy queue submission.
- Removed the same copy-success status message from drag-and-drop copy submission.
- Kept move/conflict/error status messaging intact.

**User-facing impact:**
- Copy operations now queue quietly instead of showing transient “queued” notices.

### 3. Drag-and-drop copy target robustness

**Files:**
- [`src/components/dialogs/DialogContainer.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/DialogContainer.tsx)
- [`src/components/dialogs/DialogContainer.test.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/DialogContainer.test.tsx)
- [`src/components/panel/FileList.tsx`](/Users/back/workspace/MyCommander/src/components/panel/FileList.tsx)
- [`src/components/panel/FileList.test.tsx`](/Users/back/workspace/MyCommander/src/components/panel/FileList.test.tsx)

**Summary:**
- Preserved drag-copy payloads across overwrite/error loops.
- Added fallback handling for blank `targetPath`, blank `resolvedPath`, and pointer-derived panel targeting.
- Improved cross-panel drop-path selection and protected nested-folder invalid targets.

**User-facing impact:**
- Drag-copy behaves more reliably across left/right panel targeting, blank resolved paths, and overwrite retries.

### 4. Access-path normalization cleanup

**Files:**
- [`src/utils/path.ts`](/Users/back/workspace/MyCommander/src/utils/path.ts)
- [`src/components/dialogs/SearchPreviewDialogs.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/SearchPreviewDialogs.tsx)
- [`src/components/layout/ContextMenu.tsx`](/Users/back/workspace/MyCommander/src/components/layout/ContextMenu.tsx)
- [`src/components/layout/StatusBar.tsx`](/Users/back/workspace/MyCommander/src/components/layout/StatusBar.tsx)
- [`src/components/panel/AddressBar.tsx`](/Users/back/workspace/MyCommander/src/components/panel/AddressBar.tsx)
- [`src/components/panel/FilePanel.tsx`](/Users/back/workspace/MyCommander/src/components/panel/FilePanel.tsx)
- [`src/hooks/useAppCommands.ts`](/Users/back/workspace/MyCommander/src/hooks/useAppCommands.ts)
- [`src/store/panelRefresh.ts`](/Users/back/workspace/MyCommander/src/store/panelRefresh.ts)
- [`src/store/panelStore.ts`](/Users/back/workspace/MyCommander/src/store/panelStore.ts)
- [`src/store/panelWatch.ts`](/Users/back/workspace/MyCommander/src/store/panelWatch.ts)
- [`src/components/dialogs/SyncDialog.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/SyncDialog.tsx)

**Summary:**
- Centralized `resolvedPath ?? currentPath` behavior into `coalescePanelPath`.
- Switched panel refresh, watching, UI commands, and several dialog/layout components to the shared helper.

**User-facing impact:**
- Reduces path mismatch regressions, especially in symlink/CloudStorage-style paths where display and access paths differ.

### 5. Folder synchronization correctness fix

**Files:**
- [`src/components/dialogs/SyncDialog.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/SyncDialog.tsx)
- [`src/components/dialogs/SyncDialog.test.tsx`](/Users/back/workspace/MyCommander/src/components/dialogs/SyncDialog.test.tsx)
- [`src/features/syncExecution.ts`](/Users/back/workspace/MyCommander/src/features/syncExecution.ts)
- [`src/hooks/useFileSystem.ts`](/Users/back/workspace/MyCommander/src/hooks/useFileSystem.ts)
- [`src/types/sync.ts`](/Users/back/workspace/MyCommander/src/types/sync.ts)
- [`src-tauri/src/commands/sync_commands.rs`](/Users/back/workspace/MyCommander/src-tauri/src/commands/sync_commands.rs)

**Summary:**
- Added sync item kind metadata (`file` / `directory`) to the compare result.
- Removed shared-directory metadata noise from Rust comparison output.
- Moved sync execution planning into a dedicated helper that:
  - preserves relative paths
  - targets exact destination paths
  - collapses redundant child operations under whole-directory syncs

**User-facing impact:**
- Fixes the folder sync bug where contents could land in the wrong place or be duplicated.

### 6. Documentation refresh

**Files:**
- [`README.md`](/Users/back/workspace/MyCommander/README.md)
- [`CLAUDE.md`](/Users/back/workspace/MyCommander/CLAUDE.md)

**Summary:**
- Updated README release example from `1.1.10` to `1.1.20`.
- Expanded CLAUDE context with unified job engine and settings store notes.
- Documented ProgressDialog and JobCenter in the implementation summary.

---

## Release Risks To Resolve Before Tagging

- The worktree is broad and touches both bug fixes and context/docs. Before release, confirm that all modified files belong in the same release scope.
- Folder synchronization has automated coverage now, but it still deserves one manual smoke pass in the desktop app because it mutates real directory trees.
- Since `v1.1.19` already exists, reusing `1.1.19` would make tag creation fail or create release ambiguity.

---

## Plan To Tag Push

### Task 1: Freeze Release Scope

- [ ] Review `git status --short` and confirm that the current modified files all belong in the next release.
- [ ] If any file is unrelated to this release, split it out before staging.
- [ ] Keep the release on `main` only if direct-to-main is intended; otherwise branch before staging.

### Task 2: Manual Smoke Check The Highest-Risk Flows

- [ ] Run `npm run tauri dev`.
- [ ] Verify F5 copy no longer throws `submit_job` payload errors.
- [ ] Verify drag-copy still works and no longer shows the copy queued toast.
- [ ] Verify `명령 > 폴더 동기화` with a nested folder tree:
  - changed file under nested directory
  - missing directory with nested file
  - unchanged common directory
- [ ] Confirm synced files land under the correct relative destination paths.

### Task 3: Stage The Release Contents

- [ ] Stage the code and docs intended for the release.
- [ ] Run `git diff --cached --stat` and `git diff --cached` to verify the staged scope.
- [ ] Make sure generated/build artifacts are still excluded.

### Task 4: Bump The Release Version

- [ ] Bump from `1.1.19` to `1.1.20` unless a different release number is chosen.
- [ ] Use a non-tagging version bump first so the release commit message can follow the Lore protocol:

```bash
npm version 1.1.20 --no-git-tag-version
```

- [ ] Verify both files changed together:
  - [`package.json`](/Users/back/workspace/MyCommander/package.json)
  - [`src-tauri/tauri.conf.json`](/Users/back/workspace/MyCommander/src-tauri/tauri.conf.json)

### Task 5: Re-run Release Verification

- [ ] Run:

```bash
./node_modules/.bin/tsc --noEmit
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run test:rust
```

- [ ] If the version bump changed only metadata and no code, the expected result is all green with no behavior change.

### Task 6: Create The Release Commit

- [ ] Stage the version bump and any remaining release files.
- [ ] Create one English Lore-format commit message, for example:

```text
Stabilize copy and folder sync flows for the next desktop release

This release bundles job payload hardening, quieter copy queue UX,
drag/drop path fixes, and folder sync correctness work, along with
matching docs updates and verification coverage.

Constraint: Existing tag v1.1.19 already exists
Rejected: Reuse 1.1.19 | tag collision and ambiguous release history
Confidence: high
Scope-risk: moderate
Directive: Do not retag without bumping package and Tauri versions together
Tested: ./node_modules/.bin/tsc --noEmit; npm run test; cargo check --manifest-path src-tauri/Cargo.toml; npm run test:rust; manual smoke check for copy and folder sync
Not-tested: Full packaged app install/upgrade flow
```

### Task 7: Create The Annotated Release Tag

- [ ] Create the tag after the release commit:

```bash
git tag -a v1.1.20 -m "v1.1.20"
```

- [ ] Verify the tag points at the intended release commit:

```bash
git show --stat v1.1.20
```

### Task 8: Push Branch And Tag

- [ ] Push `main` first:

```bash
git push origin main
```

- [ ] Push the tag:

```bash
git push origin v1.1.20
```

- [ ] Optionally verify remote tag presence:

```bash
git ls-remote --tags origin v1.1.20
```

---

## Recommendation

If the goal is a clean release from the current worktree, the safest path is:

1. One manual sync smoke test
2. Scope review of the currently modified files
3. Version bump to `1.1.20`
4. Lore-format release commit
5. Annotated tag `v1.1.20`
6. Push `main`, then push `v1.1.20`

That sequence avoids the existing `v1.1.19` tag collision and keeps the release history explicit.
