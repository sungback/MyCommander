import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class MockChannel<T> {
    onmessage?: (message: T) => void;
  },
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { useFileSystem, getErrorMessage } from './useFileSystem';
import { mockFiles, mockDrives } from '../test/mocks/tauri';

const mockInvoke = vi.mocked(invoke);

describe('useFileSystem', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  // ─── listDirectory ────────────────────────────────────────────────────────
  describe('listDirectory', () => {
    it('returns file entries for a given path', async () => {
      mockInvoke.mockResolvedValueOnce(mockFiles);
      const result = await useFileSystem().listDirectory('/home/user');
      expect(mockInvoke).toHaveBeenCalledWith('list_directory', {
        path: '/home/user',
        show_hidden: false,
      });
      expect(result).toEqual(mockFiles);
    });

    it('passes show_hidden=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(mockFiles);
      await useFileSystem().listDirectory('/home/user', true);
      expect(mockInvoke).toHaveBeenCalledWith('list_directory', {
        path: '/home/user',
        show_hidden: true,
      });
    });

    it('throws on error (does not swallow it)', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('permission denied'));
      await expect(useFileSystem().listDirectory('/root')).rejects.toThrow('permission denied');
    });
  });

  // ─── getHomeDir ────────────────────────────────────────────────────────────
  describe('getHomeDir', () => {
    it('returns home directory path', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user');
      const result = await useFileSystem().getHomeDir();
      expect(mockInvoke).toHaveBeenCalledWith('get_home_dir');
      expect(result).toBe('/home/user');
    });

    it('returns "/" as safe fallback on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('failed'));
      const result = await useFileSystem().getHomeDir();
      expect(result).toBe('/');
    });
  });

  describe('resolvePath', () => {
    it('returns the resolved path', async () => {
      mockInvoke.mockResolvedValueOnce('/real/path');
      const result = await useFileSystem().resolvePath('/alias/path');
      expect(mockInvoke).toHaveBeenCalledWith('resolve_path', { path: '/alias/path' });
      expect(result).toBe('/real/path');
    });

    it('throws when resolution fails', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('does not exist'));
      await expect(useFileSystem().resolvePath('/missing')).rejects.toThrow('does not exist');
    });
  });

  // ─── getDrives ─────────────────────────────────────────────────────────────
  describe('getDrives', () => {
    it('returns list of drives', async () => {
      mockInvoke.mockResolvedValueOnce(mockDrives);
      const result = await useFileSystem().getDrives();
      expect(mockInvoke).toHaveBeenCalledWith('get_drives');
      expect(result).toEqual(mockDrives);
    });

    it('returns empty array on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('failed'));
      const result = await useFileSystem().getDrives();
      expect(result).toEqual([]);
    });
  });

  // ─── getAvailableSpace ─────────────────────────────────────────────────────
  describe('getAvailableSpace', () => {
    it('returns available space in bytes', async () => {
      mockInvoke.mockResolvedValueOnce(100_000_000_000);
      const result = await useFileSystem().getAvailableSpace('/');
      expect(mockInvoke).toHaveBeenCalledWith('get_available_space', { path: '/' });
      expect(result).toBe(100_000_000_000);
    });

    it('returns null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('failed'));
      const result = await useFileSystem().getAvailableSpace('/');
      expect(result).toBeNull();
    });
  });

  // ─── createDirectory ───────────────────────────────────────────────────────
  describe('createDirectory', () => {
    it('invokes create_directory with correct path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().createDirectory('/home/user/NewFolder');
      expect(mockInvoke).toHaveBeenCalledWith('create_directory', {
        path: '/home/user/NewFolder',
      });
    });
  });

  // ─── createFile ────────────────────────────────────────────────────────────
  describe('createFile', () => {
    it('invokes create_file with correct path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().createFile('/home/user/new.txt');
      expect(mockInvoke).toHaveBeenCalledWith('create_file', {
        path: '/home/user/new.txt',
      });
    });
  });

  // ─── deleteFiles ───────────────────────────────────────────────────────────
  describe('deleteFiles', () => {
    it('sends permanent=false by default', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().deleteFiles(['/home/user/file.txt']);
      expect(mockInvoke).toHaveBeenCalledWith('delete_files', {
        paths: ['/home/user/file.txt'],
        permanent: false,
      });
    });

    it('sends permanent=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().deleteFiles(['/home/user/file.txt'], true);
      expect(mockInvoke).toHaveBeenCalledWith('delete_files', {
        paths: ['/home/user/file.txt'],
        permanent: true,
      });
    });

    it('supports multiple paths', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().deleteFiles(['/home/user/a.txt', '/home/user/b.txt']);
      expect(mockInvoke).toHaveBeenCalledWith('delete_files', {
        paths: ['/home/user/a.txt', '/home/user/b.txt'],
        permanent: false,
      });
    });
  });

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

  // ─── renameFile ────────────────────────────────────────────────────────────
  describe('renameFile', () => {
    it('invokes rename_file with old and new paths', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().renameFile('/home/user/old.txt', '/home/user/new.txt');
      expect(mockInvoke).toHaveBeenCalledWith('rename_file', {
        old_path: '/home/user/old.txt',
        new_path: '/home/user/new.txt',
      });
    });
  });

  describe('applyBatchRename', () => {
    it('invokes apply_batch_rename with mapped operations', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().applyBatchRename([
        { oldPath: '/home/user/a.txt', newPath: '/home/user/b.txt' },
        { oldPath: '/home/user/c.txt', newPath: '/home/user/d.txt' },
      ]);
      expect(mockInvoke).toHaveBeenCalledWith('apply_batch_rename', {
        operations: [
          { old_path: '/home/user/a.txt', new_path: '/home/user/b.txt' },
          { old_path: '/home/user/c.txt', new_path: '/home/user/d.txt' },
        ],
      });
    });
  });

  // ─── copyFiles ─────────────────────────────────────────────────────────────
  describe('copyFiles', () => {
    it('invokes copy_files with source paths and target', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      await useFileSystem().copyFiles(['/home/user/a.txt', '/home/user/b.txt'], '/home/user/dest');
      expect(mockInvoke).toHaveBeenCalledWith('copy_files', {
        source_paths: ['/home/user/a.txt', '/home/user/b.txt'],
        target_path: '/home/user/dest',
        keep_both: false,
      });
    });

    it('invokes copy_files with keep_both=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(['a copy.txt']);
      const result = await useFileSystem().copyFiles(['/home/user/a.txt'], '/home/user/dest', true);
      expect(mockInvoke).toHaveBeenCalledWith('copy_files', {
        source_paths: ['/home/user/a.txt'],
        target_path: '/home/user/dest',
        keep_both: true,
      });
      expect(result).toEqual(['a copy.txt']);
    });
  });

  // ─── moveFiles ─────────────────────────────────────────────────────────────
  describe('moveFiles', () => {
    it('invokes move_files with source paths and target dir', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().moveFiles(['/home/user/a.txt'], '/home/user/dest');
      expect(mockInvoke).toHaveBeenCalledWith('move_files', {
        source_paths: ['/home/user/a.txt'],
        target_dir: '/home/user/dest',
      });
    });
  });

  // ─── extractZip ────────────────────────────────────────────────────────────
  describe('extractZip', () => {
    it('returns the extraction output path', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/archive');
      const result = await useFileSystem().extractZip('/home/user/archive.zip');
      expect(mockInvoke).toHaveBeenCalledWith('extract_zip', { path: '/home/user/archive.zip' });
      expect(result).toBe('/home/user/archive');
    });
  });

  // ─── createZip ────────────────────────────────────────────────────────────
  describe('createZip', () => {
    it('returns the created zip path', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/Documents.zip');
      const result = await useFileSystem().createZip('/home/user/Documents');
      expect(mockInvoke).toHaveBeenCalledWith('create_zip', { path: '/home/user/Documents' });
      expect(result).toBe('/home/user/Documents.zip');
    });
  });

  // ─── readFileContent ───────────────────────────────────────────────────────
  describe('readFileContent', () => {
    it('returns file text content', async () => {
      mockInvoke.mockResolvedValueOnce('hello world');
      const result = await useFileSystem().readFileContent('/home/user/notes.txt');
      expect(mockInvoke).toHaveBeenCalledWith('read_file_content', {
        path: '/home/user/notes.txt',
      });
      expect(result).toBe('hello world');
    });
  });

  // ─── getDirSize ────────────────────────────────────────────────────────────
  describe('getDirSize', () => {
    it('returns directory size in bytes', async () => {
      mockInvoke.mockResolvedValueOnce(4096);
      const result = await useFileSystem().getDirSize('/home/user/Documents');
      expect(mockInvoke).toHaveBeenCalledWith('get_dir_size', {
        path: '/home/user/Documents',
      });
      expect(result).toBe(4096);
    });
  });

  // ─── openInTerminal ────────────────────────────────────────────────────────
  describe('openInTerminal', () => {
    it('invokes open_in_terminal with correct path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().openInTerminal('/home/user');
      expect(mockInvoke).toHaveBeenCalledWith('open_in_terminal', { path: '/home/user' });
    });
  });

  // ─── runShellCommand ───────────────────────────────────────────────────────
  describe('runShellCommand', () => {
    it('invokes run_shell_command with path and command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().runShellCommand('/home/user', 'ls -la');
      expect(mockInvoke).toHaveBeenCalledWith('run_shell_command', {
        path: '/home/user',
        command: 'ls -la',
      });
    });
  });

  // ─── openInEditor ──────────────────────────────────────────────────────────
  describe('openInEditor', () => {
    it('invokes open_in_editor with correct path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().openInEditor('/home/user/notes.txt');
      expect(mockInvoke).toHaveBeenCalledWith('open_in_editor', {
        path: '/home/user/notes.txt',
      });
    });
  });

  // ─── openFile ──────────────────────────────────────────────────────────────
  describe('openFile', () => {
    it('invokes open_file with correct path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().openFile('/home/user/photo.png');
      expect(mockInvoke).toHaveBeenCalledWith('open_file', { path: '/home/user/photo.png' });
    });
  });

  // ─── quitApp ───────────────────────────────────────────────────────────────
  describe('quitApp', () => {
    it('invokes quit_app command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await useFileSystem().quitApp();
      expect(mockInvoke).toHaveBeenCalledWith('quit_app');
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
        on_event: expect.objectContaining({ onmessage: onEvent }),
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

// ─── getErrorMessage ───────────────────────────────────────────────────────────
describe('getErrorMessage', () => {
  const fallback = 'Something went wrong';

  it('extracts message from Error object', () => {
    expect(getErrorMessage(new Error('disk full'), fallback)).toBe('disk full');
  });

  it('extracts message from TypeError', () => {
    expect(getErrorMessage(new TypeError('invalid path'), fallback)).toBe('invalid path');
  });

  it('returns string error as-is', () => {
    expect(getErrorMessage('permission denied', fallback)).toBe('permission denied');
  });

  it('extracts message property from plain object', () => {
    expect(getErrorMessage({ message: 'not found' }, fallback)).toBe('not found');
  });

  it('returns fallback for null', () => {
    expect(getErrorMessage(null, fallback)).toBe(fallback);
  });

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined, fallback)).toBe(fallback);
  });

  it('returns fallback for empty string', () => {
    expect(getErrorMessage('', fallback)).toBe(fallback);
  });

  it('returns fallback for whitespace-only string', () => {
    expect(getErrorMessage('   ', fallback)).toBe(fallback);
  });

  it('returns fallback for object without message', () => {
    expect(getErrorMessage({ code: 404 }, fallback)).toBe(fallback);
  });

  it('returns fallback for number', () => {
    expect(getErrorMessage(42, fallback)).toBe(fallback);
  });
});
