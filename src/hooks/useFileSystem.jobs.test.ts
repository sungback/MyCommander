import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: class MockChannel<T> {
    onmessage?: (message: T) => void;
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { useFileSystem } from './useFileSystem';
import {
  registerMockInvokeReset,
} from './useFileSystem.test-harness';

const mockInvoke = vi.mocked(invoke);

describe('useFileSystem', () => {
  registerMockInvokeReset(mockInvoke);

  describe('submitJob', () => {
    it('invokes submit_job with a snake_case copy payload for Tauri', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-1',
        kind: 'copy',
        status: 'queued',
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });

      await useFileSystem().submitJob({
        kind: 'copy',
        sourcePaths: ['/home/user/a.txt'],
        targetPath: '/home/user/dest',
      });

      expect(mockInvoke).toHaveBeenCalledWith('submit_job', {
        job: {
          kind: 'copy',
          source_paths: ['/home/user/a.txt'],
          target_path: '/home/user/dest',
        },
      });
    });

    it('passes overwrite through copy job submissions', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-overwrite',
        kind: 'copy',
        status: 'queued',
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });

      await useFileSystem().submitJob({
        kind: 'copy',
        sourcePaths: ['/home/user/a.txt'],
        targetPath: '/home/user/dest',
        keepBoth: false,
        overwrite: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('submit_job', {
        job: {
          kind: 'copy',
          source_paths: ['/home/user/a.txt'],
          target_path: '/home/user/dest',
          keep_both: false,
          overwrite: true,
        },
      });
    });

    it('invokes submit_job with a snake_case move payload for Tauri', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-2',
        kind: 'move',
        status: 'queued',
        createdAt: 2,
        updatedAt: 2,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });

      await useFileSystem().submitJob({
        kind: 'move',
        sourcePaths: ['/home/user/a.txt'],
        targetDir: '/home/user/dest',
      });

      expect(mockInvoke).toHaveBeenCalledWith('submit_job', {
        job: {
          kind: 'move',
          source_paths: ['/home/user/a.txt'],
          target_dir: '/home/user/dest',
        },
      });
    });

    it('invokes submit_job with a snake_case zipSelection payload for Tauri', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-3',
        kind: 'zip',
        status: 'queued',
        createdAt: 3,
        updatedAt: 3,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });

      await useFileSystem().submitJob({
        kind: 'zipSelection',
        paths: ['/home/user/a.txt'],
        targetDir: '/home/user',
        archiveName: 'Archive.zip',
      });

      expect(mockInvoke).toHaveBeenCalledWith('submit_job', {
        job: {
          kind: 'zipSelection',
          paths: ['/home/user/a.txt'],
          target_dir: '/home/user',
          archive_name: 'Archive.zip',
        },
      });
    });
  });

  describe('listJobs', () => {
    it('invokes list_jobs without arguments', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      await useFileSystem().listJobs();
      expect(mockInvoke).toHaveBeenCalledWith('list_jobs');
    });
  });

  describe('cancelJob', () => {
    it('invokes cancel_job with the target id', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-1',
        kind: 'copy',
        status: 'cancelled',
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: 'Cancelled before start',
        result: null,
      });

      await useFileSystem().cancelJob('job-1');
      expect(mockInvoke).toHaveBeenCalledWith('cancel_job', { job_id: 'job-1' });
    });
  });

  describe('retryJob', () => {
    it('invokes retry_job with the target id', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'job-2',
        kind: 'copy',
        status: 'queued',
        createdAt: 2,
        updatedAt: 2,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });

      await useFileSystem().retryJob('job-1');
      expect(mockInvoke).toHaveBeenCalledWith('retry_job', { job_id: 'job-1' });
    });
  });

  describe('clearFinishedJobs', () => {
    it('invokes clear_finished_jobs without arguments', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().clearFinishedJobs();
      expect(mockInvoke).toHaveBeenCalledWith('clear_finished_jobs');
    });
  });

  describe('writeFilesToPasteboard', () => {
    it('invokes write_files_to_pasteboard with paths and operation', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().writeFilesToPasteboard(['/home/user/a.txt'], 'copy');
      expect(mockInvoke).toHaveBeenCalledWith('write_files_to_pasteboard', {
        paths: ['/home/user/a.txt'],
        operation: 'copy',
      });
    });
  });

  describe('setShowHiddenMenuChecked', () => {
    it('invokes set_show_hidden_menu_checked with checked state', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().setShowHiddenMenuChecked(true);
      expect(mockInvoke).toHaveBeenCalledWith('set_show_hidden_menu_checked', {
        checked: true,
      });
    });
  });

  describe('setThemeMenuSelection', () => {
    it('invokes set_theme_menu_selection with the theme preference', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().setThemeMenuSelection('dark');
      expect(mockInvoke).toHaveBeenCalledWith('set_theme_menu_selection', {
        theme: 'dark',
      });
    });
  });

  describe('setViewModeMenuSelection', () => {
    it('invokes set_view_mode_menu_selection with both panel modes', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().setViewModeMenuSelection('brief', 'detailed');
      expect(mockInvoke).toHaveBeenCalledWith('set_view_mode_menu_selection', {
        leftMode: 'brief',
        rightMode: 'detailed',
      });
    });
  });

  describe('showContextMenu', () => {
    it('maps the context menu request to snake_case for Tauri', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().showContextMenu({
        x: 10,
        y: 20,
        hasTargetItem: true,
        canRename: true,
        canCreateZip: false,
        canExtractZip: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith('show_context_menu', {
        request: {
          x: 10,
          y: 20,
          has_target_item: true,
          can_rename: true,
          can_create_zip: false,
          can_extract_zip: true,
        },
      });
    });
  });
});
