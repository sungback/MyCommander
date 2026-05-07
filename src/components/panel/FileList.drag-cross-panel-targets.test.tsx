import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  makeProps,
  mockCheckCopyConflicts,
  mockElementFromPoint,
  mockOpenDragCopyDialog,
  mockSubmitJob,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList cross-panel drag copy', () => {
  registerFileListTestLifecycle();

    it('충돌이 없으면 copy 다이얼로그 없이 즉시 복사한다', async () => {
      render(
        <>
          <FileList
            {...makeProps({
              selectedItems: new Set<string>(['/home/user/notes.txt']),
              panelId: 'left',
            })}
          />
          <FileList
            {...makeProps({
              currentPath: '/target',
              accessPath: '/target',
              files: [
                { name: '..', path: '/', kind: 'directory' },
                { name: 'Inbox', path: '/target/Inbox', kind: 'directory', size: null },
              ],
              selectedItems: new Set<string>(),
              panelId: 'right',
            })}
          />
        </>
      );

      const lists = document.querySelectorAll('[tabindex="0"]');
      const sourceList = lists[0] as HTMLElement;
      const targetList = lists[1] as HTMLElement;

      Object.defineProperty(sourceList, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 300,
          bottom: 300,
          width: 300,
          height: 300,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      Object.defineProperty(targetList, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 320,
          top: 0,
          right: 620,
          bottom: 300,
          width: 300,
          height: 300,
          x: 320,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const sourceRow = document.querySelector(
        '[data-entry-path="/home/user/notes.txt"]'
      ) as HTMLElement;

      mockElementFromPoint(targetList);
      fireEvent.mouseDown(sourceRow, {
        button: 0,
        clientX: 20,
        clientY: 20,
      });

      await act(async () => {
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 360, clientY: 40 })
        );
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 364, clientY: 44 })
        );
      });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 364, clientY: 44 }));
      });

      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/home/user/notes.txt'],
        '/target'
      );
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'copy',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/target',
      });
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('right 패널에서 left 패널의 폴더 위로 드롭하면 해당 폴더를 대상으로 복사한다', async () => {
      render(
        <>
          <FileList
            {...makeProps({
              currentPath: '/left',
              accessPath: '/left',
              files: [
                { name: '..', path: '/', kind: 'directory' },
                { name: 'Inbox', path: '/left/Inbox', kind: 'directory', size: null },
              ],
              selectedItems: new Set<string>(),
              panelId: 'left',
            })}
          />
          <FileList
            {...makeProps({
              currentPath: '/right',
              accessPath: '/right',
              files: [
                { name: '..', path: '/', kind: 'directory' },
                { name: 'notes.txt', path: '/right/notes.txt', kind: 'file', size: 1024 },
              ],
              selectedItems: new Set<string>(['/right/notes.txt']),
              panelId: 'right',
            })}
          />
        </>
      );

      const lists = document.querySelectorAll('[tabindex="0"]');
      const targetList = lists[0] as HTMLElement;
      const sourceList = lists[1] as HTMLElement;

      Object.defineProperty(targetList, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 300,
          bottom: 300,
          width: 300,
          height: 300,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      Object.defineProperty(sourceList, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 320,
          top: 0,
          right: 620,
          bottom: 300,
          width: 300,
          height: 300,
          x: 320,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const sourceRow = document.querySelector(
        '[data-entry-path="/right/notes.txt"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/left/Inbox"]'
      ) as HTMLElement;

      mockElementFromPoint(targetRow);
      fireEvent.mouseDown(sourceRow, {
        button: 0,
        clientX: 340,
        clientY: 20,
      });

      await act(async () => {
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 40, clientY: 40 })
        );
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 44, clientY: 44 })
        );
      });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 44, clientY: 44 }));
      });

      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ['/right/notes.txt'],
        '/left/Inbox'
      );
      expect(mockSubmitJob).toHaveBeenCalledWith({
        kind: 'copy',
        sourcePaths: ['/right/notes.txt'],
        targetPath: '/left/Inbox',
      });
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });
});
