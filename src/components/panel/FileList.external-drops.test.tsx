import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  getListEl,
  makeProps,
  mockCheckCopyConflicts,
  mockOpenDragCopyDialog,
  mockSubmitJob,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList', () => {
  registerFileListTestLifecycle();

  describe('external file drops', () => {
    const dropExternalFile = async (list: HTMLElement, path: string) => {
      await act(async () => {
        fireEvent.drop(list, {
          dataTransfer: {
            files: {
              0: { path } as unknown as File,
              length: 1,
            },
          },
        });
      });
    };

    it('외부 파일 드롭은 충돌 확인 후 copy job을 등록한다', async () => {
      render(<FileList {...makeProps()} />);

      const list = getListEl();
      await dropExternalFile(list, '/external/notes.txt');

      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/external/notes.txt'],
        '/home/user'
      );
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'copy',
        sourcePaths: ['/external/notes.txt'],
        targetPath: '/home/user',
      });
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('외부 파일 드롭 충돌 시 즉시 덮어쓰지 않고 복사 충돌 다이얼로그를 연다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
      render(<FileList {...makeProps()} />);

      const list = getListEl();
      await dropExternalFile(list, '/external/notes.txt');

      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
        sourcePanelId: 'left',
        targetPanelId: 'left',
        sourcePaths: ['/external/notes.txt'],
        targetPath: '/home/user',
      });
    });
  });
});
