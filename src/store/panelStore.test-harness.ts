import { beforeEach } from 'vitest';
import { usePanelStore } from './panelStore';

export const registerPanelStoreReset = () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
  });
};

export { usePanelStore };
