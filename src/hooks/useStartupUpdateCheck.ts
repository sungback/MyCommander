import { useEffect } from "react";
import { useUpdateStore } from "../store/updateStore";

export const STARTUP_UPDATE_CHECK_DELAY_MS = 1500;

export const useStartupUpdateCheck = () => {
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void useUpdateStore.getState().checkForUpdates({ silent: true });
    }, STARTUP_UPDATE_CHECK_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);
};
