import { describe, expect, it } from 'vitest';
import { registerPanelStoreReset, usePanelStore } from './panelStore.test-harness';

registerPanelStoreReset();

// 크기 캐시 액션의 동작 고정 테스트: 기존 테스트가 덮지 않는 상태 전이와
// "바뀐 게 없으면 같은 state를 돌려준다"는 계약을 확인한다.
const folder = (path: string) => ({
  name: path.split('/').pop() ?? path,
  path,
  kind: 'directory' as const,
});

const findEntry = (panel: 'leftPanel' | 'rightPanel', path: string) =>
  usePanelStore.getState()[panel].files.find((entry) => entry.path === path);

describe('panelStore — setEntrySizeStatus', () => {
  it('양쪽 패널 항목의 상태를 바꾸지만 계산 중 상태는 캐시하지 않는다', () => {
    const { setFiles, setEntrySizeStatus } = usePanelStore.getState();
    setFiles('left', [folder('/work/dir')]);
    setFiles('right', [folder('/work/dir')]);

    setEntrySizeStatus('left', '/work/dir', 'calculating');

    expect(findEntry('leftPanel', '/work/dir')?.sizeStatus).toBe('calculating');
    expect(findEntry('rightPanel', '/work/dir')?.sizeStatus).toBe('calculating');
    expect(usePanelStore.getState().sizeStatusCache['/work/dir']).toBeUndefined();
  });

  it('안정 상태(estimated·partial·exact·limited)는 캐시한다', () => {
    const { setEntrySizeStatus } = usePanelStore.getState();

    for (const status of ['estimated', 'partial', 'exact', 'limited'] as const) {
      setEntrySizeStatus('left', '/work/stable', status);
      expect(usePanelStore.getState().sizeStatusCache['/work/stable']).toBe(status);
    }
  });

  it('같은 상태를 다시 설정하면 state 객체가 그대로 유지된다', () => {
    const { setFiles, setEntrySizeStatus } = usePanelStore.getState();
    setFiles('left', [folder('/work/dir')]);
    setEntrySizeStatus('left', '/work/dir', 'exact');

    const before = usePanelStore.getState();
    setEntrySizeStatus('left', '/work/dir', 'exact');

    expect(usePanelStore.getState()).toBe(before);
  });
});

describe('panelStore — updateEntrySizeProgress', () => {
  it('항목을 계산 중으로 표시하고 크기만 캐시하며 상태는 캐시하지 않는다', () => {
    const { setFiles, updateEntrySizeProgress } = usePanelStore.getState();
    setFiles('left', [folder('/work/dir')]);

    updateEntrySizeProgress('left', '/work/dir', 500);

    const entry = findEntry('leftPanel', '/work/dir');
    expect(entry?.size).toBe(500);
    expect(entry?.sizeStatus).toBe('calculating');
    expect(usePanelStore.getState().sizeCache['/work/dir']).toBe(500);
    expect(usePanelStore.getState().sizeStatusCache['/work/dir']).toBeUndefined();
  });

  it('이미 캐시된 크기보다 작거나 같은 진행값은 무시한다', () => {
    const { updateEntrySize, updateEntrySizeProgress } = usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 800);

    const before = usePanelStore.getState();
    updateEntrySizeProgress('left', '/work/dir', 800);
    expect(usePanelStore.getState()).toBe(before);

    updateEntrySizeProgress('left', '/work/dir', 100);
    expect(usePanelStore.getState()).toBe(before);
  });

  it('같은 진행값을 반복해도 state가 바뀌지 않는다', () => {
    const { updateEntrySizeProgress } = usePanelStore.getState();
    updateEntrySizeProgress('left', '/work/dir', 500);

    const before = usePanelStore.getState();
    updateEntrySizeProgress('left', '/work/dir', 500);

    expect(usePanelStore.getState()).toBe(before);
  });
});

describe('panelStore — 변경이 없으면 같은 state를 돌려준다', () => {
  it('updateEntrySize: 같은 값을 다시 저장해도 state가 유지된다', () => {
    const { updateEntrySize } = usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 100);

    const before = usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 100);

    expect(usePanelStore.getState()).toBe(before);
  });

  it('updateEntrySizeEstimate: 같은 추정값을 다시 저장해도 state가 유지된다', () => {
    const { updateEntrySizeEstimate } = usePanelStore.getState();
    updateEntrySizeEstimate('left', '/work/dir', 100, 'estimated');

    const before = usePanelStore.getState();
    updateEntrySizeEstimate('left', '/work/dir', 100, 'estimated');

    expect(usePanelStore.getState()).toBe(before);
  });

  it('applyScannedChildSizes: 빈 목록이면 state가 유지된다', () => {
    const before = usePanelStore.getState();
    usePanelStore.getState().applyScannedChildSizes([], Date.now());

    expect(usePanelStore.getState()).toBe(before);
  });

  it('invalidateEntrySizes: 캐시에 없는 경로면 state가 유지된다', () => {
    const before = usePanelStore.getState();
    usePanelStore.getState().invalidateEntrySizes(['/nothing/here']);

    expect(usePanelStore.getState()).toBe(before);
  });
});

describe('panelStore — hydrateEntrySizesFromCache', () => {
  it('빈 목록이면 state가 유지된다', () => {
    const before = usePanelStore.getState();
    usePanelStore.getState().hydrateEntrySizesFromCache([]);

    expect(usePanelStore.getState()).toBe(before);
  });

  it('이미 신선한 안정 값이 있으면 복원값으로 덮어쓰지 않는다', () => {
    const { updateEntrySize, hydrateEntrySizesFromCache } = usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 500);

    hydrateEntrySizesFromCache([
      { path: '/work/dir', size: 999, status: 'exact', isStale: false },
    ]);

    expect(usePanelStore.getState().sizeCache['/work/dir']).toBe(500);
  });

  it('stale인 기존 값은 복원값으로 바뀌고 stale 표시가 지워진다', () => {
    const { updateEntrySize, markEntrySizesStale, hydrateEntrySizesFromCache } =
      usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 500);
    markEntrySizesStale(['/work/dir']);
    expect(usePanelStore.getState().sizeCacheStale['/work/dir']).toBe(true);

    hydrateEntrySizesFromCache([
      { path: '/work/dir', size: 999, status: 'exact', isStale: false },
    ]);

    expect(usePanelStore.getState().sizeCache['/work/dir']).toBe(999);
    expect(usePanelStore.getState().sizeCacheStale['/work/dir']).toBe(false);
  });

  it('시스템 폴더의 partial 값은 estimated로 복원한다', () => {
    usePanelStore.getState().hydrateEntrySizesFromCache([
      { path: '/Users', size: 1, status: 'partial', isStale: false },
    ]);

    expect(usePanelStore.getState().sizeStatusCache['/Users']).toBe('estimated');
  });
});

describe('panelStore — markEntrySizesStale', () => {
  it('캐시에 없는 경로는 무시하고 state를 유지한다', () => {
    const before = usePanelStore.getState();
    usePanelStore.getState().markEntrySizesStale(['/unknown/dir']);

    expect(usePanelStore.getState()).toBe(before);
    expect(usePanelStore.getState().sizeCacheStale['/unknown/dir']).toBeUndefined();
  });

  it('이미 stale이면 다시 표시해도 state가 유지된다', () => {
    const { updateEntrySize, markEntrySizesStale } = usePanelStore.getState();
    updateEntrySize('left', '/work/dir', 500);
    markEntrySizesStale(['/work/dir']);

    const before = usePanelStore.getState();
    markEntrySizesStale(['/work/dir']);

    expect(usePanelStore.getState()).toBe(before);
  });
});
