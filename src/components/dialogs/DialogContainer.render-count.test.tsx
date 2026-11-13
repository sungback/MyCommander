import { Profiler } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { registerDialogContainerTestLifecycle } from './DialogContainer.test-harness';
import { DialogContainer } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

// 하위 대화상자는 각자 패널을 구독하므로, DialogContainer 자체의 구독만 검증하도록 제외합니다.
vi.mock('./palette/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('./TransferSpaceWarningDialog', () => ({ TransferSpaceWarningDialog: () => null }));

describe('DialogContainer render count', () => {
  registerDialogContainerTestLifecycle();

  it('does not re-render on cursor moves while every dialog is closed', () => {
    useDialogStore.getState().closeDialog();
    let commits = 0;
    render(
      <Profiler id="dialog-container" onRender={() => { commits += 1; }}>
        <DialogContainer />
      </Profiler>
    );
    const base = commits;

    for (let i = 1; i <= 5; i++) {
      act(() => {
        usePanelStore.setState((state) => ({
          ...state,
          leftPanel: { ...state.leftPanel, cursorIndex: i },
        }));
      });
    }

    expect(commits).toBe(base);
  });
});
