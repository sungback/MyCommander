import { useEffect } from "react";
import { loadPersistentSizeCache } from "../store/directorySizeCachePersistence";
import { usePanelStore } from "../store/panelStore";

export const usePersistentSizeCache = () => {
  const hydrateEntrySizesFromCache = usePanelStore(
    (state) => state.hydrateEntrySizesFromCache
  );

  useEffect(() => {
    let disposed = false;

    void loadPersistentSizeCache().then((entries) => {
      if (disposed || entries.length === 0) {
        return;
      }

      hydrateEntrySizesFromCache(entries);
    });

    return () => {
      disposed = true;
    };
  }, [hydrateEntrySizesFromCache]);
};
