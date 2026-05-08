import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import { registerMockInvokeReset } from './useFileSystem.test-harness';
import { useFileSystem } from './useFileSystem';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

describe('useFileSystem launch commands', () => {
  registerMockInvokeReset(mockInvoke);

  it('invokes open_in_terminal with correct path', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useFileSystem().openInTerminal('/home/user');
    expect(mockInvoke).toHaveBeenCalledWith('open_in_terminal', { path: '/home/user' });
  });

  it('invokes run_shell_command with path and command', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useFileSystem().runShellCommand('/home/user', 'ls -la');
    expect(mockInvoke).toHaveBeenCalledWith('run_shell_command', {
      path: '/home/user',
      command: 'ls -la',
    });
  });

  it('invokes open_in_editor with correct path', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useFileSystem().openInEditor('/home/user/notes.txt');
    expect(mockInvoke).toHaveBeenCalledWith('open_in_editor', {
      path: '/home/user/notes.txt',
    });
  });

  it('invokes open_file with correct path', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useFileSystem().openFile('/home/user/photo.png');
    expect(mockInvoke).toHaveBeenCalledWith('open_file', { path: '/home/user/photo.png' });
  });

  it('invokes quit_app command', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await useFileSystem().quitApp();
    expect(mockInvoke).toHaveBeenCalledWith('quit_app');
  });
});
