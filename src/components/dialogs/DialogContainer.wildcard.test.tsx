import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockShowTransientStatusMessage,
  registerDialogContainerTestLifecycle,
} from './DialogContainer.test-harness';
import { DialogContainer } from './DialogContainer';
import { useDialogStore } from '../../store/dialogStore';
import { usePanelStore } from '../../store/panelStore';

describe('DialogContainer — wildcard select', () => {
  registerDialogContainerTestLifecycle();

  beforeEach(() => {
    const { setFiles, setCursor, clearSelection } = usePanelStore.getState();
    clearSelection('left');
    setFiles('left', [
      { name: '..', path: '/test/..', kind: 'directory' },
      { name: 'document.pdf', path: '/test/document.pdf', kind: 'file' },
      { name: 'image.png', path: '/test/image.png', kind: 'file' },
      { name: 'archive.zip', path: '/test/archive.zip', kind: 'file' },
    ]);
    // Sorted order: 0: "..", 1: "archive.zip", 2: "document.pdf", 3: "image.png"
    setCursor('left', 2); // cursor on document.pdf
  });

  it('renders wildcard select dialog with default pattern derived from cursor file extension', () => {
    useDialogStore.getState().openWildcardDialog('select');

    render(<DialogContainer />);

    expect(screen.getByText('패턴으로 파일 선택')).toBeInTheDocument();
    expect(screen.getByDisplayValue('*.pdf')).toBeInTheDocument();
  });

  it('applies selection to matching files and closes dialog', () => {
    useDialogStore.getState().openWildcardDialog('select');

    render(<DialogContainer />);

    const submitBtn = screen.getByRole('button', { name: '선택' });
    fireEvent.click(submitBtn);

    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has('/test/document.pdf')).toBe(true);
    expect(selected.has('/test/image.png')).toBe(false);
    expect(useDialogStore.getState().openDialog).toBeNull();
    expect(mockShowTransientStatusMessage).toHaveBeenCalledWith('1개 항목이 선택되었습니다');
  });

  it('inverts selection from dialog button', () => {
    useDialogStore.getState().openWildcardDialog('select');

    render(<DialogContainer />);

    const invertBtn = screen.getByRole('button', { name: '현재 선택 반전 (Invert)' });
    fireEvent.click(invertBtn);

    const selected = usePanelStore.getState().leftPanel.selectedItems;
    expect(selected.has('/test/document.pdf')).toBe(true);
    expect(selected.has('/test/image.png')).toBe(true);
    expect(selected.has('/test/archive.zip')).toBe(true);
    expect(selected.has('/test/..')).toBe(false);
    expect(useDialogStore.getState().openDialog).toBeNull();
    expect(mockShowTransientStatusMessage).toHaveBeenCalledWith('선택이 반전되었습니다');
  });
});
