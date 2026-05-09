import { beforeEach } from 'vitest';
import { useGitStatusStore } from './gitStatusStore';

export const registerGitStatusStoreReset = () => {
  beforeEach(() => {
    useGitStatusStore.getState().clear();
  });
};

export { useGitStatusStore };
