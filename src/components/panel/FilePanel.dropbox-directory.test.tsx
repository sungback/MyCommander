import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  lastFileListProps,
  mockGetDirSize,
  mockListDirectory,
  mockResolvePath,
  registerFilePanelTestLifecycle,
  setLeftPanelPath,
} from './FilePanel.test-harness';
import { FilePanel } from './FilePanel';
import { usePanelStore } from '../../store/panelStore';

describe('FilePanel Dropbox-like directories', () => {
  registerFilePanelTestLifecycle();

  it("enters Dropbox-like directories even when they are listed as directories", async () => {
    const dropboxEntry = {
      name: "Dropbox",
      path: "/Users/back/Dropbox",
      kind: "directory" as const,
      size: null,
    };

    mockListDirectory.mockImplementation(async (path: string) => {
      if (path === "/Users/back") {
        return [dropboxEntry];
      }

      if (path === "/Users/back/Library/CloudStorage/Dropbox") {
        return [];
      }

      throw new Error(`unexpected path: ${path}`);
    });
    mockResolvePath.mockImplementation(async (path: string) =>
      path === "/Users/back/Dropbox"
        ? "/Users/back/Library/CloudStorage/Dropbox"
        : path
    );
    mockGetDirSize.mockResolvedValue(0);

    setLeftPanelPath("/Users/back");
    render(<FilePanel id="left" />);

    await waitFor(() => {
      expect(lastFileListProps).not.toBeNull();
      expect(usePanelStore.getState().leftPanel.files).toEqual([
        { ...dropboxEntry, size: 0, sizeStatus: "estimated" },
      ]);
    });

    await act(async () => {
      await lastFileListProps?.onEnter(dropboxEntry);
    });

    expect(mockResolvePath).toHaveBeenCalledWith("/Users/back/Dropbox");
    expect(mockListDirectory).toHaveBeenCalledWith(
      "/Users/back/Library/CloudStorage/Dropbox",
      false
    );
    expect(usePanelStore.getState().leftPanel.currentPath).toBe("/Users/back/Dropbox");
  });
});
