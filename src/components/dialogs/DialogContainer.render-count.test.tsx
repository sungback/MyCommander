import { Profiler } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { registerDialogContainerTestLifecycle } from './DialogContainer.test-harness';
import { DialogContainer } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

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
