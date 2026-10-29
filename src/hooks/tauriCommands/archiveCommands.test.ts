import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

import { archiveCommands } from './archiveCommands';

describe('archiveCommands', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  describe('extractZip', () => {
    it('calls invoke with extract_zip and returns resolved string', async () => {
      mockInvoke.mockResolvedValue('/output/dir');
      const result = await archiveCommands.extractZip('/path/to/file.zip');
      expect(mockInvoke).toHaveBeenCalledWith('extract_zip', { path: '/path/to/file.zip' });
      expect(result).toBe('/output/dir');
    });
  });

  describe('createZip', () => {
    it('calls invoke with create_zip and returns resolved string', async () => {
      mockInvoke.mockResolvedValue('/path/to/archive.zip');
      const result = await archiveCommands.createZip('/path/to/folder');
      expect(mockInvoke).toHaveBeenCalledWith('create_zip', { path: '/path/to/folder' });
      expect(result).toBe('/path/to/archive.zip');
    });
  });

  describe('createZipFromPaths', () => {
    it('calls invoke with create_zip_from_paths using snake_case args and returns resolved string', async () => {
      mockInvoke.mockResolvedValue('/target/archive.zip');
      const result = await archiveCommands.createZipFromPaths(
        ['/a/file1.txt', '/a/file2.txt'],
        '/target',
        'archive.zip',
      );
      expect(mockInvoke).toHaveBeenCalledWith('create_zip_from_paths', {
        paths: ['/a/file1.txt', '/a/file2.txt'],
        target_dir: '/target',
        archive_name: 'archive.zip',
      });
      expect(result).toBe('/target/archive.zip');
    });
  });

  describe('cancelZipOperation', () => {
    it('calls invoke with cancel_zip_operation and resolves void', async () => {
      mockInvoke.mockResolvedValue(undefined);
      const result = await archiveCommands.cancelZipOperation();
      expect(mockInvoke).toHaveBeenCalledWith('cancel_zip_operation');
      expect(result).toBeUndefined();
    });
  });

  describe('previewZipArchive', () => {
    it('calls invoke with preview_zip_archive and returns preview data', async () => {
      const mockPreview = {
        fileName: 'test.zip',
        fileSize: 1024,
        totalEntries: 1,
        totalFiles: 1,
        totalDirs: 0,
        totalUncompressedSize: 500,
        totalCompressedSize: 250,
        entries: [],
      };
      mockInvoke.mockResolvedValue(mockPreview);
      const result = await archiveCommands.previewZipArchive('/path/to/test.zip');
      expect(mockInvoke).toHaveBeenCalledWith('preview_zip_archive', { path: '/path/to/test.zip' });
      expect(result).toEqual(mockPreview);
    });
  });
});
