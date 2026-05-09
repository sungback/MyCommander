import { describe, it, expect, beforeEach } from 'vitest';
import { useDragStore } from './dragStore';

describe('dragStore', () => {
  beforeEach(() => {
    useDragStore.getState().setDragInfo(null);
  });

  it('초기 상태는 null', () => {
    expect(useDragStore.getState().dragInfo).toBeNull();
  });

  it('setDragInfo - left 패널', () => {
    useDragStore.getState().setDragInfo({
      paths: ['/a/foo.txt'],
      directoryPaths: ['/a'],
      sourcePanel: 'left',
    });
    expect(useDragStore.getState().dragInfo).toEqual({
      paths: ['/a/foo.txt'],
      directoryPaths: ['/a'],
      sourcePanel: 'left',
    });
  });

  it('setDragInfo - right 패널', () => {
    useDragStore.getState().setDragInfo({
      paths: ['/b/bar.ts'],
      directoryPaths: [],
      sourcePanel: 'right',
    });
    expect(useDragStore.getState().dragInfo).toEqual({
      paths: ['/b/bar.ts'],
      directoryPaths: [],
      sourcePanel: 'right',
    });
  });

  it('setDragInfo(null) - 초기화', () => {
    useDragStore.getState().setDragInfo({
      paths: ['/a/foo.txt'],
      directoryPaths: [],
      sourcePanel: 'left',
    });
    useDragStore.getState().setDragInfo(null);
    expect(useDragStore.getState().dragInfo).toBeNull();
  });
});
