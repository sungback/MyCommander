import { describe, expect, it, vi } from 'vitest';
import type { SearchOptions } from '../types/search';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: class MockChannel<T> {
    onmessage?: (message: T) => void;
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { useFileSystem } from './useFileSystem';
import { registerMockInvokeReset } from './useFileSystem.test-harness';

const mockInvoke = vi.mocked(invoke);

describe('useFileSystem', () => {
  registerMockInvokeReset(mockInvoke);

  describe('getGitStatus', () => {
    it('invokes get_git_status with the target path', async () => {
      mockInvoke.mockResolvedValueOnce({
        branch: 'main',
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
      });

      const result = await useFileSystem().getGitStatus('/repo');

      expect(mockInvoke).toHaveBeenCalledWith('get_git_status', { path: '/repo' });
      expect(result).toEqual({
        branch: 'main',
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
      });
    });
  });

  // ─── searchFiles ───────────────────────────────────────────────────────────
  describe('searchFiles', () => {
    it('invokes search_files with snake_case args and a channel', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const onEvent = vi.fn();

      await useFileSystem().searchFiles('/home/user', 'notes', false, onEvent);

      expect(mockInvoke).toHaveBeenCalledWith('search_files', {
        start_path: '/home/user',
        query: 'notes',
        use_regex: false,
        case_sensitive: true,
        include_hidden: true,
        scope: 'name',
        entry_kind: 'all',
        extensions: [],
        min_size_bytes: null,
        max_size_bytes: null,
        modified_after_ms: null,
        modified_before_ms: null,
        max_results: 5000,
        on_event: expect.objectContaining({ onmessage: onEvent }),
      });
    });

    it('wires the channel message handler to the provided callback', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const onEvent = vi.fn();

      await useFileSystem().searchFiles('/home/user', 'notes', false, onEvent);

      const [, args] = mockInvoke.mock.calls[0];
      const event = {
        type: 'Finished' as const,
        payload: { total_matches: 1 },
      };

      (
        args as { on_event: { onmessage?: (message: typeof event) => void } }
      ).on_event.onmessage?.(event);

      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it('passes use_regex=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const onEvent = vi.fn();

      await useFileSystem().searchFiles('/home/user', '.*\\.txt', true, onEvent);

      expect(mockInvoke).toHaveBeenCalledWith('search_files', {
        start_path: '/home/user',
        query: '.*\\.txt',
        use_regex: true,
        case_sensitive: true,
        include_hidden: true,
        scope: 'name',
        entry_kind: 'all',
        extensions: [],
        min_size_bytes: null,
        max_size_bytes: null,
        modified_after_ms: null,
        modified_before_ms: null,
        max_results: 5000,
        on_event: expect.objectContaining({ onmessage: onEvent }),
      });
    });

    it('passes advanced search options through to the backend payload', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const onEvent = vi.fn();
      const options: SearchOptions = {
        query: 'report',
        useRegex: false,
        caseSensitive: false,
        includeHidden: false,
        scope: 'path',
        entryKind: 'files',
        extensions: ['md', 'txt'],
        minSizeBytes: 100,
        maxSizeBytes: 4096,
        modifiedAfterMs: 1000,
        modifiedBeforeMs: 2000,
        maxResults: 250,
      };

      await useFileSystem().searchFiles('/home/user', options, onEvent);

      expect(mockInvoke).toHaveBeenCalledWith('search_files', {
        start_path: '/home/user',
        query: 'report',
        use_regex: false,
        case_sensitive: false,
        include_hidden: false,
        scope: 'path',
        entry_kind: 'files',
        extensions: ['md', 'txt'],
        min_size_bytes: 100,
        max_size_bytes: 4096,
        modified_after_ms: 1000,
        modified_before_ms: 2000,
        max_results: 250,
        on_event: expect.objectContaining({ onmessage: onEvent }),
      });
    });
  });

  // ─── compareDirectories ───────────────────────────────────────────────────
  describe('compareDirectories', () => {
    it('invokes compare_directories with show_hidden=false by default', async () => {
      mockInvoke.mockResolvedValueOnce([
        {
          rel_path: 'docs/report.md',
          left_path: '/left/docs/report.md',
          right_path: '/right/docs/report.md',
          left_kind: 'file',
          right_kind: 'file',
          status: 'LeftNewer',
        },
      ]);

      const result = await useFileSystem().compareDirectories('/left', '/right');

      expect(mockInvoke).toHaveBeenCalledWith('compare_directories', {
        left: '/left',
        right: '/right',
        show_hidden: false,
      });
      expect(result).toEqual([
        {
          relPath: 'docs/report.md',
          leftPath: '/left/docs/report.md',
          rightPath: '/right/docs/report.md',
          leftKind: 'file',
          rightKind: 'file',
          status: 'LeftNewer',
          direction: 'toRight',
        },
      ]);
    });

    it('passes show_hidden=true when requested', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await useFileSystem().compareDirectories('/left', '/right', true);

      expect(mockInvoke).toHaveBeenCalledWith('compare_directories', {
        left: '/left',
        right: '/right',
        show_hidden: true,
      });
    });
  });

  // ─── syncWatchedDirectories ────────────────────────────────────────────────
  describe('syncWatchedDirectories', () => {
    it('invokes sync_watched_directories with path list', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await useFileSystem().syncWatchedDirectories(['/Users/back/Documents', '/Users/back/Desktop']);

      expect(mockInvoke).toHaveBeenCalledWith('sync_watched_directories', {
        paths: ['/Users/back/Documents', '/Users/back/Desktop'],
      });
    });
  });
});
