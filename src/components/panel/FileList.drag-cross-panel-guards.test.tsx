import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  makeProps,
  mockCheckCopyConflicts,
  mockElementFromPoint,
  mockOpenDragCopyDialog,
  mockPanelState,
  mockSubmitJob,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList cross-panel drag copy', () => {
  registerFileListTestLifecycle();

    it('cross-panel에서 폴더를 자기 하위 폴더 루트로 빈 영역 드롭하면 복사하지 않는다', async () => {
      mockPanelState.leftPanel.currentPath = '/home/user/Project/Child';
      mockPanelState.leftPanel.resolvedPath = '/home/user/Project/Child';
      mockPanelState.rightPanel.currentPath = '/home/user';
      mockPanelState.rightPanel.resolvedPath = '/home/user';

      render(
        <>
          <FileList
            {...makeProps({
              currentPath: '/home/user/Project/Child',
              accessPath: '/home/user/Project/Child',
              files: [
                { name: '..', path: '/home/user/Project', kind: 'directory' },
                { name: 'file.txt', path: '/home/user/Project/Child/file.txt', kind: 'file', size: 1 },
              ],
              selectedItems: new Set<string>(),
              panelId: 'left',
            })}
          />
          <FileList
            {...makeProps({
              currentPath: '/home/user',
              accessPath: '/home/user',
              files: [
                { name: '..', path: '/home', kind: 'directory' },
                { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
              ],
              selectedItems: new Set<string>(['/home/user/Project']),
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
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;

      mockElementFromPoint(targetList);
      fireEvent.mouseDown(sourceRow, {
        button: 0,
        clientX: 340,
        clientY: 20,
      });

      await act(async () => {
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 80, clientY: 180 })
        );
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 84, clientY: 184 })
        );
      });

      await act(async () => {
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 84, clientY: 184 }));
      });

      expect(mockCheckCopyConflicts).not.toHaveBeenCalled();
      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });

    it('cross-panel에서 폴더를 자기 하위 폴더 위로 드롭하면 복사하지 않는다', async () => {
      mockPanelState.leftPanel.currentPath = '/home/user/Project';
      mockPanelState.leftPanel.resolvedPath = '/home/user/Project';
      mockPanelState.rightPanel.currentPath = '/home/user';
      mockPanelState.rightPanel.resolvedPath = '/home/user';

      render(
        <>
          <FileList
            {...makeProps({
              currentPath: '/home/user/Project',
              accessPath: '/home/user/Project',
              files: [
                { name: '..', path: '/home/user', kind: 'directory' },
                { name: 'Child', path: '/home/user/Project/Child', kind: 'directory', size: null },
              ],
              selectedItems: new Set<string>(),
              panelId: 'left',
            })}
          />
          <FileList
            {...makeProps({
              currentPath: '/home/user',
              accessPath: '/home/user',
              files: [
                { name: '..', path: '/home', kind: 'directory' },
                { name: 'Project', path: '/home/user/Project', kind: 'directory', size: null },
              ],
              selectedItems: new Set<string>(['/home/user/Project']),
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
        '[data-entry-path="/home/user/Project"]'
      ) as HTMLElement;
      const targetRow = document.querySelector(
        '[data-entry-path="/home/user/Project/Child"]'
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
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 44, clientY: 44 }));
      });

      expect(mockCheckCopyConflicts).not.toHaveBeenCalled();
      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).not.toHaveBeenCalled();
    });
});
