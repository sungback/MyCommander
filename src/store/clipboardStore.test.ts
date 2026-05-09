import { describe, it, expect, beforeEach } from 'vitest';
import { useClipboardStore } from './clipboardStore';

describe('clipboardStore', () => {
  beforeEach(() => {
    useClipboardStore.getState().clearClipboard();
  });

  it('초기 상태는 null', () => {
    expect(useClipboardStore.getState().clipboard).toBeNull();
  });

  it('setClipboard - copy', () => {
    useClipboardStore.getState().setClipboard({
      paths: ['/a/foo.txt'],
      operation: 'copy',
      sourcePanel: 'left',
    });
    const { clipboard } = useClipboardStore.getState();
    expect(clipboard).toEqual({
      paths: ['/a/foo.txt'],
      operation: 'copy',
      sourcePanel: 'left',
    });
  });

  it('setClipboard - cut', () => {
    useClipboardStore.getState().setClipboard({
      paths: ['/b/bar.ts', '/b/baz.ts'],
      operation: 'cut',
      sourcePanel: 'right',
    });
    const { clipboard } = useClipboardStore.getState();
    expect(clipboard).toEqual({
      paths: ['/b/bar.ts', '/b/baz.ts'],
      operation: 'cut',
      sourcePanel: 'right',
    });
  });

  it('clearClipboard - null 복원', () => {
    useClipboardStore.getState().setClipboard({
      paths: ['/a/foo.txt'],
      operation: 'copy',
      sourcePanel: 'left',
    });
    useClipboardStore.getState().clearClipboard();
    expect(useClipboardStore.getState().clipboard).toBeNull();
  });
});
