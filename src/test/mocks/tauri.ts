import { vi } from 'vitest';
import type { FileEntry } from '../../types/file';
import type { DriveInfo, SearchResult } from '../../hooks/useFileSystem';

export const mockFiles: FileEntry[] = [
  { name: '..', path: '/home/user', kind: 'directory' },
  { name: 'Documents', path: '/home/user/Documents', kind: 'directory', size: null },
  { name: 'Downloads', path: '/home/user/Downloads', kind: 'directory', size: null },
  { name: 'notes.txt', path: '/home/user/notes.txt', kind: 'file', size: 1024, lastModified: 1700000000000 },
  { name: 'photo.png', path: '/home/user/photo.png', kind: 'file', size: 2048000, lastModified: 1700000000000 },
];

export const mockDrives: DriveInfo[] = [
  {
    mount_point: '/',
    name: 'Macintosh HD',
    type: 'fixed',
    icon: 'drive',
    isEjectable: false,
    availableSpace: 100_000_000_000,
  },
];

export const mockSearchResults: SearchResult[] = [
  { name: 'notes.txt', path: '/home/user/notes.txt', size: 1024, is_dir: false },
];

/**
 * Tauri IPC mock — 모든 커맨드에 대해 기본 응답을 반환합니다.
 * 개별 테스트에서 mockResolvedValueOnce 로 덮어쓸 수 있습니다.
 */
export const createMockInvoke = () =>
  vi.fn((cmd: string, _args?: unknown): Promise<unknown> => {
    switch (cmd) {
      case 'list_directory':      return Promise.resolve(mockFiles);
      case 'get_home_dir':        return Promise.resolve('/home/user');
      case 'resolve_path':        return Promise.resolve('/home/user');
      case 'get_drives':          return Promise.resolve(mockDrives);
      case 'get_available_space': return Promise.resolve(100_000_000_000);
      case 'get_dir_size':        return Promise.resolve(4096);
      case 'create_directory':    return Promise.resolve(undefined);
      case 'create_file':         return Promise.resolve(undefined);
      case 'delete_files':        return Promise.resolve(undefined);
      case 'submit_job':          return Promise.resolve({
        id: 'job-1',
        kind: 'copy',
        status: 'queued',
        createdAt: 1,
        updatedAt: 1,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });
      case 'list_jobs':           return Promise.resolve([]);
      case 'cancel_job':          return Promise.resolve({
        id: 'job-1',
        kind: 'copy',
        status: 'cancelled',
        createdAt: 1,
        updatedAt: 2,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: 'Cancelled before start',
        result: null,
      });
      case 'retry_job':           return Promise.resolve({
        id: 'job-2',
        kind: 'copy',
        status: 'queued',
        createdAt: 2,
        updatedAt: 2,
        progress: { current: 0, total: 0, currentFile: '', unit: 'items' },
        error: null,
        result: null,
      });
      case 'clear_finished_jobs': return Promise.resolve(undefined);
      case 'rename_file':         return Promise.resolve(undefined);
      case 'apply_batch_rename':  return Promise.resolve(undefined);
      case 'copy_files':          return Promise.resolve(undefined);
      case 'move_files':          return Promise.resolve(undefined);
      case 'extract_zip':         return Promise.resolve('/home/user/archive');
      case 'create_zip':          return Promise.resolve('/home/user/Downloads.zip');
      case 'read_file_content':   return Promise.resolve('file content here');
      case 'search_files':        return Promise.resolve(mockSearchResults);
      case 'open_in_terminal':    return Promise.resolve(undefined);
      case 'open_in_editor':      return Promise.resolve(undefined);
      case 'open_file':           return Promise.resolve(undefined);
      case 'quit_app':            return Promise.resolve(undefined);
      case 'run_shell_command':   return Promise.resolve(undefined);
      default:                    return Promise.resolve(undefined);
    }
  });
