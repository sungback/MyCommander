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
} from "../FileList.test-harness";
import { FileList } from '../FileList';
import type { FileEntry } from '../../../types/file';

const notesPath = '/home/user/notes.txt';
const targetPath = '/target';

const setListRect = (element: HTMLElement, left: number) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left,
      top: 0,
      right: left + 300,
      bottom: 300,
      width: 300,
      height: 300,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
};

const getFileLists = () => {
  const lists = document.querySelectorAll('[tabindex="0"]');
  return Array.from(lists) as HTMLElement[];
};

const dragNotesToTarget = async (
  targetList: HTMLElement,
  startPoint: MouseEventInit,
  movePoints: MouseEventInit[]
) => {
  const sourceRow = document.querySelector(
    `[data-entry-path="${notesPath}"]`
  ) as HTMLElement;

  mockElementFromPoint(targetList);
  fireEvent.mouseDown(sourceRow, {
    button: 0,
    ...startPoint,
  });

  await act(async () => {
    for (const point of movePoints) {
      document.dispatchEvent(new MouseEvent('mousemove', point));
    }
    document.dispatchEvent(
      new MouseEvent('mouseup', movePoints[movePoints.length - 1])
    );
  });
};

const expectDragCopyDialog = (sourcePanelId: 'left' | 'right', targetPanelId: 'left' | 'right') => {
  expect(mockOpenDragCopyDialog).toHaveBeenCalledWith({
    sourcePanelId,
    targetPanelId,
    sourcePaths: [notesPath],
    targetPath,
  });
};

const renderLeftSourceRightTarget = (
  files: FileEntry[] = [
    { name: '..', path: '/', kind: 'directory' },
    { name: 'Inbox', path: '/target/Inbox', kind: 'directory', size: null },
  ]
) => {
  render(
    <>
      <FileList
        {...makeProps({
          selectedItems: new Set<string>([notesPath]),
          panelId: 'left',
        })}
      />
      <FileList
        {...makeProps({
          currentPath: targetPath,
          accessPath: targetPath,
          files,
          selectedItems: new Set<string>(),
          panelId: 'right',
        })}
      />
    </>
  );

  const [sourceList, targetList] = getFileLists();
  setListRect(sourceList, 0);
  setListRect(targetList, 320);
  return { sourceList, targetList };
};

describe('FileList cross-panel drag copy', () => {
  registerFileListTestLifecycle();

  it('충돌이 있으면 드래그 복사 다이얼로그를 연다', async () => {
    mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
    const { targetList } = renderLeftSourceRightTarget();

    await dragNotesToTarget(
      targetList,
      { clientX: 20, clientY: 20 },
      [
        { clientX: 360, clientY: 40 },
        { clientX: 364, clientY: 44 },
      ]
    );

    expect(mockSubmitJob).not.toHaveBeenCalled();
    expectDragCopyDialog('left', 'right');
  });

  it('충돌 드래그 시 대상 패널 resolvedPath가 빈 문자열이면 currentPath를 대상으로 사용한다', async () => {
    mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
    mockPanelState.rightPanel.currentPath = targetPath;
    mockPanelState.rightPanel.resolvedPath = '';
    const { targetList } = renderLeftSourceRightTarget([
      { name: '..', path: '/', kind: 'directory' },
    ]);

    await dragNotesToTarget(
      targetList,
      { clientX: 20, clientY: 20 },
      [
        { clientX: 360, clientY: 40 },
        { clientX: 364, clientY: 44 },
      ]
    );

    expectDragCopyDialog('left', 'right');
  });

  it('충돌 드래그 시 store 경로가 비어 있어도 대상 패널 props 경로를 대상으로 사용한다', async () => {
    mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
    mockPanelState.rightPanel.currentPath = '';
    mockPanelState.rightPanel.resolvedPath = '';
    const { targetList } = renderLeftSourceRightTarget([
      { name: '..', path: '/', kind: 'directory' },
    ]);

    await dragNotesToTarget(
      targetList,
      { clientX: 20, clientY: 20 },
      [
        { clientX: 360, clientY: 40 },
        { clientX: 364, clientY: 44 },
      ]
    );

    expectDragCopyDialog('left', 'right');
  });

  it('한 번의 mousemove 후 바로 drop해도 대상 패널 props 경로를 대상으로 사용한다', async () => {
    mockCheckCopyConflicts.mockResolvedValueOnce(['notes.txt']);
    mockPanelState.leftPanel.currentPath = '';
    mockPanelState.leftPanel.resolvedPath = '';

    render(
      <>
        <FileList
          {...makeProps({
            currentPath: targetPath,
            accessPath: targetPath,
            files: [{ name: '..', path: '/', kind: 'directory' }],
            selectedItems: new Set<string>(),
            panelId: 'left',
          })}
        />
        <FileList
          {...makeProps({
            selectedItems: new Set<string>([notesPath]),
            panelId: 'right',
          })}
        />
      </>
    );

    const [targetList, sourceList] = getFileLists();
    setListRect(targetList, 0);
    setListRect(sourceList, 320);

    await dragNotesToTarget(
      targetList,
      { clientX: 340, clientY: 20 },
      [{ clientX: 40, clientY: 40 }]
    );

    expectDragCopyDialog('right', 'left');
  });
});
