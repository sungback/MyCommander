import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  getListEl,
  makeProps,
  mockCheckCopyConflicts,
  mockElementFromPoint,
  mockListDirectory,
  mockOpenDragCopyDialog,
  mockSubmitJob,
  performInternalDrag,
  registerFileListTestLifecycle,
  setContainerRect,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList same-panel drag copy', () => {
  registerFileListTestLifecycle();

    it('같은 패널 파일 드롭은 copyFiles를 호출한다', async () => {
      render(
        <FileList
          {...makeProps({
            selectedItems: new Set<string>(['/home/user/notes.txt']),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/notes.txt"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Documents"]'
      ) as HTMLElement;

      await performInternalDrag(sourceRow, targetRow);

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
      });

      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/home/user/notes.txt'],
        '/home/user/Documents'
      );
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'copy',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/home/user/Documents',
      });
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('같은 패널 파일을 빈 영역에 드롭하면 현재 루트 대상으로 copy 경로를 유지한다', async () => {
      mockListDirectory.mockResolvedValueOnce([
        {
          name: 'ag_sandbox.py',
          path: '/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox.py',
          kind: 'file',
          size: 1024,
        },
      ]);

      render(
        <FileList
          {...makeProps({
            currentPath: '/Users/back/_Dn_/abc/backup_2026-04',
            accessPath: '/Users/back/_Dn_/abc/backup_2026-04',
            files: [
              { name: '..', path: '/Users/back/_Dn_/abc', kind: 'directory' },
              {
                name: 'work',
                path: '/Users/back/_Dn_/abc/backup_2026-04/work',
                kind: 'directory',
                size: null,
              },
            ],
            selectedItems: new Set<string>([
              '/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox.py',
            ]),
          })}
        />
      );

      const sourceRow = document.querySelector(
        '[data-entry-path="/Users/back/_Dn_/abc/backup_2026-04/work"]'
      ) as HTMLElement;

      await act(async () => {
        fireEvent.click(
          sourceRow.querySelector('[aria-label="Expand folder preview"]') as HTMLElement
        );
      });

      const sourceFileRow = document.querySelector(
        '[data-entry-path="/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox.py"]'
      ) as HTMLElement;
      const list = getListEl();

      setContainerRect();
      mockElementFromPoint(list);

      fireEvent.mouseDown(sourceFileRow, { button: 0, clientX: 20, clientY: 20 });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 320 }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 154, clientY: 324 }));
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 320 }));
      });

      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'copy',
        sourcePaths: ['/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox.py'],
        targetPath: '/Users/back/_Dn_/abc/backup_2026-04',
      });
    });

    it('현재 루트에 이미 있는 폴더를 빈 영역에 드롭하면 이동을 시도하지 않는다', async () => {
      render(
        <FileList
          {...makeProps({
            currentPath: '/Users/back/_Dn_/abc/backup_2026-04',
            accessPath: '/Users/back/_Dn_/abc/backup_2026-04',
            files: [
              { name: '..', path: '/Users/back/_Dn_/abc', kind: 'directory' },
              {
                name: 'work2',
                path: '/Users/back/_Dn_/abc/backup_2026-04/work2',
                kind: 'directory',
                size: null,
              },
            ],
            selectedItems: new Set<string>([
              '/Users/back/_Dn_/abc/backup_2026-04/work2',
            ]),
          })}
        />
      );

      const sourceRow = document.querySelector(
        '[data-entry-path="/Users/back/_Dn_/abc/backup_2026-04/work2"]'
      ) as HTMLElement;
      const list = getListEl();

      setContainerRect();
      mockElementFromPoint(list);

      fireEvent.mouseDown(sourceRow, { button: 0, clientX: 20, clientY: 20 });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 320 }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 154, clientY: 324 }));
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 320 }));
      });

      expect(mockSubmitJob).not.toHaveBeenCalled();
    });
});
