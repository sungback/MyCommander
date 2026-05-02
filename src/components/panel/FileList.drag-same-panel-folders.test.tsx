import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../../types/file';
import {
  getListEl,
  makeProps,
  mockCheckCopyConflicts,
  mockElementFromPoint,
  mockListDirectory,
  mockOpenDragCopyDialog,
  mockRefreshPanel,
  mockShowTransientToast,
  mockSubmitJob,
  performInternalDrag,
  registerFileListTestLifecycle,
  setContainerRect,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList same-panel drag copy', () => {
  registerFileListTestLifecycle();

    it('같은 패널에서 폴더 위에 드롭하면 즉시 복사한다', async () => {
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

      expect(targetRow.textContent).toContain('복사');

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
      expect(mockShowTransientToast).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('자기 자신 하위 폴더로의 드롭은 차단한다', async () => {
      const nestedFiles: FileEntry[] = [
        { name: '..', path: '/home/user', kind: 'directory' },
        { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
        {
          name: 'Project Child',
          path: '/home/user/Project/Child',
          kind: 'directory',
          size: null,
        },
      ];

      render(
        <FileList
          {...makeProps({
            files: nestedFiles,
            selectedItems: new Set<string>(['/home/user/Project']),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Project/Child"]'
      ) as HTMLElement;

      await performInternalDrag(sourceRow, targetRow, { x: 20, y: 20 }, { x: 44, y: 44 });

      expect(targetRow.textContent).toContain('불가');

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 44, clientY: 44 }));
      });

      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockRefreshPanel).not.toHaveBeenCalled();
    });

    it('같은 패널 폴더 드롭은 중첩 선택을 접어서 moveFiles를 호출한다', async () => {
      const nestedFolderFiles: FileEntry[] = [
        { name: '..', path: '/home', kind: 'directory' },
        { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
        {
          name: 'Project Child',
          path: '/home/user/Project/Child',
          kind: 'directory',
          size: null,
        },
        { name: 'Downloads', path: '/home/user/Downloads', kind: 'directory', size: null },
      ];

      render(
        <FileList
          {...makeProps({
            files: nestedFolderFiles,
            selectedItems: new Set<string>([
              '/home/user/Project',
              '/home/user/Project/Child',
            ]),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Downloads"]'
      ) as HTMLElement;

      await performInternalDrag(sourceRow, targetRow);

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
      });

      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'move',
        sourcePaths: ['/home/user/Project'],
        targetDir: '/home/user/Downloads',
      });
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/home/user/Project'],
        '/home/user/Downloads'
      );
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('같은 패널 폴더 드롭은 충돌이 있으면 moveFiles를 호출하지 않는다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['Project']);

      const nestedFolderFiles: FileEntry[] = [
        { name: '..', path: '/home', kind: 'directory' },
        { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
        {
          name: 'Project Child',
          path: '/home/user/Project/Child',
          kind: 'directory',
          size: null,
        },
        { name: 'Downloads', path: '/home/user/Downloads', kind: 'directory', size: null },
      ];

      render(
        <FileList
          {...makeProps({
            files: nestedFolderFiles,
            selectedItems: new Set<string>([
              '/home/user/Project',
              '/home/user/Project/Child',
            ]),
          })}
        />
      );

      setContainerRect();

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Downloads"]'
      ) as HTMLElement;

      await performInternalDrag(sourceRow, targetRow);

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
      });

      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/home/user/Project'],
        '/home/user/Downloads'
      );
      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('확장된 하위 폴더를 같은 패널 빈 영역에 드롭하면 현재 루트로 이동한다', async () => {
      const files: FileEntry[] = [
        { name: '..', path: '/Users/back/_Dn_/abc', kind: 'directory' },
        {
          name: 'work',
          path: '/Users/back/_Dn_/abc/backup_2026-04/work',
          kind: 'directory',
          size: null,
        },
      ];

      mockListDirectory.mockResolvedValueOnce([
        {
          name: 'ag_sandbox',
          path: '/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox',
          kind: 'directory',
          size: null,
        },
      ]);

      render(
        <FileList
          {...makeProps({
            currentPath: '/Users/back/_Dn_/abc/backup_2026-04',
            accessPath: '/Users/back/_Dn_/abc/backup_2026-04',
            files,
            selectedItems: new Set<string>([
              '/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox',
            ]),
          })}
        />
      );

      await act(async () => {
        fireEvent.click(
          document
            .querySelector('[data-entry-path="/Users/back/_Dn_/abc/backup_2026-04/work"]')
            ?.querySelector('[aria-label="Expand folder preview"]') as HTMLElement
        );
      });

      const sourceRow = document.querySelector(
        '[data-entry-path="/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox"]'
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

      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'move',
        sourcePaths: ['/Users/back/_Dn_/abc/backup_2026-04/work/ag_sandbox'],
        targetDir: '/Users/back/_Dn_/abc/backup_2026-04',
      });
    });
});
