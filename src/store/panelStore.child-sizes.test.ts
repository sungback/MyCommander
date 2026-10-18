import { describe, expect, it, vi } from 'vitest';
import {
  getPendingPersistentSizeCacheUpserts,
  registerPanelStoreReset,
  usePanelStore,
} from './panelStore.test-harness';
import {
  expireSizeVerificationOutside,
  getSizeScannedAt,
  isSizeVerifiedThisSession,
  markSizeVerifiedThisSession,
  recordSizeChange,
  recordSizeScannedAt,
} from './panelStoreFileHelpers';
import type { ScannedChildDirectorySize } from '../types/file';

registerPanelStoreReset();

const child = (
  path: string,
  overrides: Partial<ScannedChildDirectorySize> = {}
): ScannedChildDirectorySize => ({
  path,
  size: 1000,
  isPartial: false,
  inaccessibleCount: 0,
  depth: 1,
  ...overrides,
});

describe('panelStore — applyScannedChildSizes', () => {
  it('stores child sizes with exact, limited and partial statuses', () => {
    usePanelStore.getState().applyScannedChildSizes(
      [
        child('/root/exact', { size: 10 }),
        child('/root/limited', { size: 20, inaccessibleCount: 2 }),
        child('/root/partial', { size: 30, isPartial: true }),
      ],
      1_000
    );

    const state = usePanelStore.getState();
    expect(state.sizeCache['/root/exact']).toBe(10);
    expect(state.sizeStatusCache['/root/exact']).toBe('exact');
    expect(state.sizeStatusCache['/root/limited']).toBe('limited');
    expect(state.sizeStatusCache['/root/partial']).toBe('partial');
    expect(state.sizeCacheStale['/root/exact']).toBe(false);
    expect(getSizeScannedAt('/root/exact')).toBe(1_000);
    expect(isSizeVerifiedThisSession('/root/exact')).toBe(true);
  });

  it('shows child sizes immediately when the folder is opened', () => {
    const { applyScannedChildSizes, setFiles } = usePanelStore.getState();
    applyScannedChildSizes([child('/root/Library/Caches', { size: 4096 })], 1_000);

    setFiles('left', [{ name: 'Caches', path: '/root/Library/Caches', kind: 'directory' }]);

    const entry = usePanelStore.getState().leftPanel.files.find((file) => file.name === 'Caches');
    expect(entry?.size).toBe(4096);
    expect(entry?.sizeStatus).toBe('exact');
  });

  it('keeps a value calculated after the parent scan started', () => {
    const { applyScannedChildSizes, updateEntrySize } = usePanelStore.getState();
    updateEntrySize('left', '/root/newer', 777);
    recordSizeScannedAt('/root/newer', 5_000);

    applyScannedChildSizes([child('/root/newer', { size: 1 })], 1_000);

    expect(usePanelStore.getState().sizeCache['/root/newer']).toBe(777);
  });

  it('lets the exact child value replace a quick estimate made after the scan started', () => {
    const { applyScannedChildSizes, updateEntrySizeEstimate } = usePanelStore.getState();
    updateEntrySizeEstimate('left', '/root/estimated', 5, 'estimated');
    recordSizeScannedAt('/root/estimated', 5_000);

    applyScannedChildSizes([child('/root/estimated', { size: 900 })], 1_000);

    const state = usePanelStore.getState();
    expect(state.sizeCache['/root/estimated']).toBe(900);
    expect(state.sizeStatusCache['/root/estimated']).toBe('exact');
  });

  it('updates visible panel entries and caches hidden children', () => {
    const { applyScannedChildSizes, setFiles } = usePanelStore.getState();
    setFiles('left', [{ name: 'visible', path: '/root/visible', kind: 'directory' }]);

    applyScannedChildSizes(
      [child('/root/visible', { size: 11 }), child('/root/hidden', { size: 22 })],
      1_000
    );

    const state = usePanelStore.getState();
    const visible = state.leftPanel.files.find((file) => file.name === 'visible');
    expect(visible?.size).toBe(11);
    expect(visible?.sizeStatus).toBe('exact');
    expect(state.sizeCache['/root/hidden']).toBe(22);
  });

  it('keeps a child stale when it changed during the parent scan', () => {
    recordSizeChange('/root/changed', 1_500);

    usePanelStore.getState().applyScannedChildSizes([child('/root/changed')], 1_000);

    const state = usePanelStore.getState();
    expect(state.sizeCache['/root/changed']).toBe(1000);
    expect(state.sizeCacheStale['/root/changed']).toBe(true);
    expect(isSizeVerifiedThisSession('/root/changed')).toBe(false);
  });

  it('persists only direct children to the disk cache', () => {
    // 디스크 캐시 쓰기는 Tauri 런타임에서만 대기열에 들어간다. 가짜 타이머로 실제 저장은 막는다.
    vi.useFakeTimers();
    Object.assign(window, { __TAURI_INTERNALS__: {} });
    try {
      usePanelStore.getState().applyScannedChildSizes(
        [child('/root/direct', { depth: 1 }), child('/root/direct/nested', { depth: 2 })],
        1_000
      );

      const pending = getPendingPersistentSizeCacheUpserts();
      expect(pending.map((entry) => entry.path)).toEqual(['/root/direct']);
      expect(pending[0].scannedAt).toBe(1_000);
      // 사용자가 열지 않은 하위 폴더는 최근 사용 시각을 바꾸지 않는다.
      expect(pending[0].lastUsedAt).toBeUndefined();
      expect(usePanelStore.getState().sizeCache['/root/direct/nested']).toBe(1000);
    } finally {
      Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe('expireSizeVerificationOutside', () => {
  it('keeps verification only for paths inside the watched roots', () => {
    markSizeVerifiedThisSession('/work/a');
    markSizeVerifiedThisSession('/work/a/b');
    markSizeVerifiedThisSession('/workspace');
    markSizeVerifiedThisSession('/data/x');

    expireSizeVerificationOutside(['/work', '/data/x']);

    expect(isSizeVerifiedThisSession('/work/a')).toBe(true);
    expect(isSizeVerifiedThisSession('/work/a/b')).toBe(true);
    // 이름 앞부분만 같은 형제 경로는 감시 범위가 아니다.
    expect(isSizeVerifiedThisSession('/workspace')).toBe(false);
    expect(isSizeVerifiedThisSession('/data/x')).toBe(true);
  });

  it('expires every verification when nothing is watched', () => {
    markSizeVerifiedThisSession('/work/a');

    expireSizeVerificationOutside([]);

    expect(isSizeVerifiedThisSession('/work/a')).toBe(false);
  });
});
