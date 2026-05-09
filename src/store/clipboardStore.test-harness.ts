import { beforeEach } from 'vitest';
import { useClipboardStore } from './clipboardStore';

export const registerClipboardStoreReset = () => {
  beforeEach(() => {
    useClipboardStore.getState().clearClipboard();
  });
};

export { useClipboardStore };
