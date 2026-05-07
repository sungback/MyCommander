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

    it('충돌이 있으면 드래그 복사 다이얼로그를 연다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);

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

      expect(mockSubmitJob).not.toHaveBeenCalled();
      expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
        sourcePanelId: 'left',
        targetPanelId: 'right',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/target',
      });
    });

    it('충돌 드래그 시 대상 패널 resolvedPath가 빈 문자열이면 currentPath를 대상으로 사용한다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
      mockPanelState.rightPanel.currentPath = '/target';
      mockPanelState.rightPanel.resolvedPath = '';

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
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 364, clientY: 44 }));
      });

      expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
        sourcePanelId: 'left',
        targetPanelId: 'right',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/target',
      });
    });

    it('충돌 드래그 시 store 경로가 비어 있어도 대상 패널 props 경로를 대상으로 사용한다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
      mockPanelState.rightPanel.currentPath = '';
      mockPanelState.rightPanel.resolvedPath = '';

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
              files: [{ name: '..', path: '/', kind: 'directory' }],
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
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 364, clientY: 44 }));
      });

      expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
        sourcePanelId: 'left',
        targetPanelId: 'right',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/target',
      });
    });

    it('한 번의 mousemove 후 바로 drop해도 대상 패널 props 경로를 대상으로 사용한다', async () => {
      mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
      mockPanelState.leftPanel.currentPath = '';
      mockPanelState.leftPanel.resolvedPath = '';

      render(
        <>
          <FileList
            {...makeProps({
              currentPath: '/target',
              accessPath: '/target',
              files: [{ name: '..', path: '/', kind: 'directory' }],
              selectedItems: new Set<string>(),
              panelId: 'left',
            })}
          />
          <FileList
            {...makeProps({
              selectedItems: new Set<string>(['/home/user/notes.txt']),
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
        '[data-entry-path="/home/user/notes.txt"]'
      ) as HTMLElement;

      mockElementFromPoint(targetList);
      fireEvent.mouseDown(sourceRow, {
        button: 0,
        clientX: 340,
        clientY: 20,
      });

      await act(async () => {
        document.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 40, clientY: 40 })
        );
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
      });

      expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
        sourcePanelId: 'right',
        targetPanelId: 'left',
        sourcePaths: ['/home/user/notes.txt'],
        targetPath: '/target',
      });
    });
});
