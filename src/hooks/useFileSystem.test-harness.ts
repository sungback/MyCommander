import { beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { mockFiles, mockDrives } from '../test/mocks/tauri';

export const registerMockInvokeReset = (mockInvoke: Mock) => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });
};

export { mockDrives, mockFiles };
