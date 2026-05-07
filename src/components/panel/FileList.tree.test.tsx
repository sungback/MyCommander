import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../../types/file';
import {
  TEST_FILES,
  makeProps,
  mockListDirectory,
  mockPanelState,
  registerFileListTestLifecycle,
} from './FileList.test-harness';
import { FileList } from './FileList';

describe('FileList', () => {
  registerFileListTestLifecycle();

  describe('트리 펼치기 / 접기', () => {
    const CHILD_FILES: FileEntry[] = [
      { name: 'Work', path: '/home/user/Documents/Work', kind: 'directory' },
      { name: 'report.pdf', path: '/home/user/Documents/report.pdf', kind: 'file', size: 512 },
    ];

    // Documents 항목 안의 expand 버튼을 찾는 헬퍼
    // (..  항목에도 같은 aria-label이 있어 querySelector가 .. 버튼을 먼저 반환하므로 명시적으로 지정)
    const getDocExpandBtn = () =>
      document
        .querySelector('[data-entry-path="/home/user/Documents"]')
        ?.querySelector('[aria-label="Expand folder preview"]') as HTMLElement;

    const getDocCollapseBtn = () =>
      document
        .querySelector('[data-entry-path="/home/user/Documents"]')
        ?.querySelector('[aria-label="Collapse folder preview"]') as HTMLElement;

    it('expand 버튼 클릭 → listDirectory 호출', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(mockListDirectory).toHaveBeenCalledWith('/home/user/Documents', false);
    });

    it('expand 후 자식 항목이 렌더링된다', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/report.pdf"]')
      ).toBeInTheDocument();
    });

    it('expand 후 collapse 버튼 클릭 → 자식 항목 숨김', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      // 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      // 접기
      fireEvent.click(getDocCollapseBtn());

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).not.toBeInTheDocument();
    });

    it('두 번째 expand 클릭 시 listDirectory를 다시 호출하지 않는다 (캐시)', async () => {
      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      render(<FileList {...makeProps()} />);

      // 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      // 접기
      fireEvent.click(getDocCollapseBtn());

      // 다시 펼치기
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      // listDirectory는 최초 1회만 호출됨
      expect(mockListDirectory).toHaveBeenCalledTimes(1);
    });

    it('상위 목록이 새로고침되면 펼친 폴더 캐시를 다시 동기화한다', async () => {
      const { rerender } = render(<FileList {...makeProps()} />);

      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      mockListDirectory.mockResolvedValueOnce([
        { name: 'report.pdf', path: '/home/user/Documents/report.pdf', kind: 'file', size: 512 },
      ]);

      await act(async () => {
        rerender(
          <FileList
            {...makeProps({
              files: [...TEST_FILES.map((entry) => ({ ...entry }))],
            })}
          />
        );
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockListDirectory).toHaveBeenCalledTimes(2);
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/report.pdf"]')
      ).toBeInTheDocument();
    });

    it('패널 refresh 신호만 바뀌어도 펼친 폴더 캐시를 다시 동기화한다', async () => {
      const props = makeProps();
      const { rerender } = render(<FileList {...props} />);

      mockListDirectory.mockResolvedValueOnce(CHILD_FILES);
      await act(async () => {
        fireEvent.click(getDocExpandBtn());
      });

      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).toBeInTheDocument();

      mockPanelState.leftPanel.tabs = [
        { id: 'tab1', sortField: 'name', sortDirection: 'asc', lastUpdated: 999 },
      ];
      mockPanelState.leftPanel.activeTabId = 'tab1';
      mockPanelState.leftPanel.lastUpdated = 999;
      mockListDirectory.mockResolvedValueOnce([
        { name: 'report.pdf', path: '/home/user/Documents/report.pdf', kind: 'file', size: 512 },
      ]);

      await act(async () => {
        rerender(<FileList {...props} />);
        await Promise.resolve();
      });

      expect(mockListDirectory).toHaveBeenCalledTimes(2);
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/Work"]')
      ).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-entry-path="/home/user/Documents/report.pdf"]')
      ).toBeInTheDocument();
    });
  });
});
