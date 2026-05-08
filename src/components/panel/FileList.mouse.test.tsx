import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TEST_FILES,
  makeProps,
  mockClearSelection,
  mockSelectOnly,
  mockSetSelection,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList mouse interactions', () => {
  registerFileListTestLifecycle();

  it('항목 클릭 → setCursorIndex 호출', () => {
    const setCursorIndex = vi.fn();
    render(<FileList {...makeProps({ cursorIndex: 0, setCursorIndex })} />);
    const wrapper = document.querySelector(
      '[data-entry-path="/home/user/Documents"]'
    ) as HTMLElement;
    fireEvent.click(wrapper.firstElementChild as HTMLElement);
    expect(setCursorIndex).toHaveBeenCalledWith(1);
  });

  it('항목 클릭 → 해당 항목만 선택한다', () => {
    render(<FileList {...makeProps({ cursorIndex: 0 })} />);
    const wrapper = document.querySelector(
      '[data-entry-path="/home/user/Documents"]'
    ) as HTMLElement;

    fireEvent.click(wrapper.firstElementChild as HTMLElement);

    expect(mockSelectOnly).toHaveBeenCalledWith('left', '/home/user/Documents');
    expect(mockClearSelection).not.toHaveBeenCalled();
  });

  it('Cmd/Ctrl 클릭 → 기존 선택에 항목을 토글한다', () => {
    const onSelect = vi.fn();
    render(<FileList {...makeProps({ cursorIndex: 0, onSelect })} />);
    const wrapper = document.querySelector(
      '[data-entry-path="/home/user/Documents"]'
    ) as HTMLElement;

    fireEvent.click(wrapper.firstElementChild as HTMLElement, { ctrlKey: true });

    expect(onSelect).toHaveBeenCalledWith('/home/user/Documents', true);
    expect(mockSelectOnly).not.toHaveBeenCalled();
  });

  it('Shift 클릭 → 앵커에서 클릭한 항목까지 범위 선택한다', () => {
    render(<FileList {...makeProps({ cursorIndex: 1 })} />);
    const wrapper = document.querySelector(
      '[data-entry-path="/home/user/notes.txt"]'
    ) as HTMLElement;

    fireEvent.click(wrapper.firstElementChild as HTMLElement, { shiftKey: true });

    expect(mockSetSelection).toHaveBeenCalledWith('left', [
      '/home/user/Documents',
      '/home/user/Downloads',
      '/home/user/notes.txt',
    ]);
  });

  it('항목 더블클릭 → onEnter 호출', () => {
    const onEnter = vi.fn();
    render(<FileList {...makeProps({ onEnter })} />);
    const wrapper = document.querySelector(
      '[data-entry-path="/home/user/notes.txt"]'
    ) as HTMLElement;
    fireEvent.dblClick(wrapper.firstElementChild as HTMLElement);
    expect(onEnter).toHaveBeenCalledWith(TEST_FILES[3]);
  });
});
