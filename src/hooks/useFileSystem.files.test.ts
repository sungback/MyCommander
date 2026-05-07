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
  mockDrives,
  mockFiles,
  registerMockInvokeReset,
} from './useFileSystem.test-harness';

const mockInvoke = vi.mocked(invoke);

describe('useFileSystem', () => {
  registerMockInvokeReset(mockInvoke);

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
        overwrite: false,
      });
    });

    it('invokes copy_files with keep_both=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(['a copy.txt']);
      const result = await useFileSystem().copyFiles(['/home/user/a.txt'], '/home/user/dest', true);
      expect(mockInvoke).toHaveBeenCalledWith('copy_files', {
        source_paths: ['/home/user/a.txt'],
        target_path: '/home/user/dest',
        keep_both: true,
        overwrite: false,
      });
      expect(result).toEqual(['a copy.txt']);
    });

    it('invokes copy_files with overwrite=true when specified', async () => {
      mockInvoke.mockResolvedValueOnce(['a.txt']);
      await useFileSystem().copyFiles(['/home/user/a.txt'], '/home/user/dest/a.txt', false, true);
      expect(mockInvoke).toHaveBeenCalledWith('copy_files', {
        source_paths: ['/home/user/a.txt'],
        target_path: '/home/user/dest/a.txt',
        keep_both: false,
        overwrite: true,
      });
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
});
