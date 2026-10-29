import { beforeEach } from 'vitest';
import { useLocationHistoryStore } from './locationHistoryStore';
import { usePanelStore } from './panelStore';
import {
  __clearPendingPersistentSizeCacheWritesForTests,
  __getPendingPersistentSizeCacheUpsertsForTests,
} from './directorySizeCachePersistence';
import { __resetSessionVerifiedSizesForTests } from './panelStoreFileHelpers';

export const registerPanelStoreReset = () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    useLocationHistoryStore.setState({ locations: [] });
    __resetSessionVerifiedSizesForTests();
    __clearPendingPersistentSizeCacheWritesForTests();
  });
};

export const getPendingPersistentSizeCacheUpserts = __getPendingPersistentSizeCacheUpsertsForTests;

export { usePanelStore };
