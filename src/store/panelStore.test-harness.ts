import { beforeEach } from 'vitest';
import { useLocationHistoryStore } from './locationHistoryStore';
import { usePanelStore } from './panelStore';

export const registerPanelStoreReset = () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    useLocationHistoryStore.setState({ locations: [] });
  });
};

export { usePanelStore };
