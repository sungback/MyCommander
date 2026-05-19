# MyCommander Gap Analysis

**Date:** 2026-05-19
**Basis:** Source review against the current repository state
**Status:** Current improvement pass completed

---

## Summary

The previous gap report contained stale claims. The current source already includes an app-level `ErrorBoundary`, an initial file-list skeleton, preview error states, toast feedback, job progress dialogs, background directory size estimation, exact size scans, and persistent size-cache hydration.

The 2026-05-19 improvement pass closed the source-backed gaps that were actionable in the current codebase: user-facing error consistency, accessibility/busy-state polish, and sync/progress clarity. Documentation drift prevention remains a maintenance practice rather than a one-time code task.

---

## Already Implemented

- App-level crash fallback: `src/main.tsx` wraps `App` with `src/components/ErrorBoundary.tsx`.
- Initial file list skeleton: `src/components/panel/FileListSkeleton.tsx` is rendered from `FilePanel` while the first directory load is pending.
- Quick preview error state: `useQuickPreviewState` converts load failures to preview error UI.
- Expanded-folder failure feedback: `useExpandedDirectories` shows a toast when child preview loading fails.
- Job progress and history: `ProgressDialog`, `JobCenterDialog`, and `useJobQueue` cover queued/running/failed/finished jobs.
- Directory size workflow: `useBackgroundDirSizes`, `manualDirectorySizeScan`, and persistent cache helpers cover estimate, exact scan, partial results, cancellation, and cache restore.
- Tauri command alignment check: `npm run verify:tauri-commands` validates command registration, permission files, and capability entries.
- Manual directory-size failures now show an error toast and mark the row as failed.
- File list loading and sync execution now expose busy/progress semantics for assistive technology.
- Sync comparison now distinguishes an empty comparison from a failed comparison.
- Rendered preview source-highlight failures now show an inline warning while falling back to raw source.

---

## Completed Improvements

### 1. Error Feedback Consistency

**Status:** Completed for verified current hotspots

Updated files:

- `src/hooks/useDirectoryWatch.ts`: watch sync/cleanup failures now show warning toasts.
- `src/store/directorySizeCachePersistence.ts`: cache load/persist failures now warn once per session.
- `src/components/panel/useFileListKeyboard.ts`: explicit directory-size scan failures now show an error toast.
- `src/components/dialogs/useQuickPreviewState.ts`: source-highlight failures now return an inline warning state.

Tests:

- `src/hooks/useDirectoryWatch.test.ts`
- `src/store/directorySizeCachePersistence.test.ts`
- `src/components/panel/FileList.render-keyboard.test.tsx`
- `src/components/dialogs/useQuickPreviewState.test.ts`
- `src/components/dialogs/QuickPreviewDialog.test.tsx`

### 2. Accessibility And Busy States

**Status:** Completed for verified current hotspots

Updated files:

- `src/components/panel/FileListSkeleton.tsx`: exposes initial loading as a polite status.
- `src/components/panel/FilePanel.tsx`: marks the panel busy while directory loading is active.
- `src/components/panel/FileList.tsx`: exposes the file list as a listbox.
- `src/components/panel/FileItem.tsx`: exposes option selection state and directory-size status labels.
- `src/components/dialogs/SyncDialog.tsx`: marks analyzing/executing stages busy and exposes sync progress as a progressbar.

Tests:

- `src/components/panel/FileItem.test.tsx`
- `src/components/dialogs/SyncDialog.test.tsx`

### 3. Sync And Long-Running Progress Clarity

**Status:** Completed for verified current hotspots

Updated files:

- `src/components/dialogs/SyncDialog.tsx`: empty compare results now show a distinct “No differences found” state and disable Synchronize when no actionable item exists.
- `src/components/dialogs/SyncDialog.tsx`: synchronization progress now includes progressbar semantics.
- `src/components/panel/FileItem.tsx`: estimated, partial, exact, calculating, and failed directory-size states now expose explanatory labels.

Tests:

- `src/components/dialogs/SyncDialog.test.tsx`
- `src/components/panel/FileItem.test.tsx`

---

## Remaining Maintenance Guardrail

### Documentation Drift

**Impact:** Low
**Cadence:** Ongoing

Recommended direction:

- Treat `README.md` as user/contributor onboarding.
- Treat `CLAUDE.md` as implementation context.
- Treat `AGENTS.md` as process and verification rules.
- When a new command, Tauri permission, user-visible feature, or deliberate design policy lands, update the matching document in the same change.

---

## Future Audit Backlog

These are not known current defects. They are the next audit areas to revisit before a release or after large feature work.

1. Re-run a console-only failure inventory after major UI or Tauri command changes.
2. Re-check dialog focus behavior after adding or refactoring dialogs.
3. Re-check file operation safety tests whenever copy/move/delete/drag/sync logic changes.
4. Keep README command examples aligned with `package.json` scripts.

---

## Verification Notes

Current source-backed checks performed during this improvement pass:

- `npm run typecheck`
- `npm run verify:tauri-commands`
- Targeted Vitest run:
  `npm run test -- --run src/components/panel/FileItem.test.tsx src/components/panel/FileList.render-keyboard.test.tsx src/components/dialogs/useQuickPreviewState.test.ts src/components/dialogs/QuickPreviewDialog.test.tsx src/components/dialogs/SyncDialog.test.tsx src/hooks/useDirectoryWatch.test.ts src/store/directorySizeCachePersistence.test.ts`

Recommended for future code changes:

- Frontend-only changes: `npm run verify:frontend`
- Rust/Tauri command changes: `npm run verify:rust` and `npm run verify:tauri-commands`
- Cross-boundary changes: `npm run verify`
