import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  STARTUP_UPDATE_CHECK_DELAY_MS,
  useStartupUpdateCheck,
} from "./useStartupUpdateCheck";
import { useUpdateStore } from "../store/updateStore";

vi.mock("../store/updateStore", () => {
  const checkForUpdates = vi.fn().mockResolvedValue(undefined);
  return {
    useUpdateStore: {
      getState: () => ({
        checkForUpdates,
      }),
    },
  };
});

describe("useStartupUpdateCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules silent update check after delay", async () => {
    const checkForUpdates = useUpdateStore.getState().checkForUpdates;
    renderHook(() => useStartupUpdateCheck());

    expect(checkForUpdates).not.toHaveBeenCalled();

    vi.advanceTimersByTime(STARTUP_UPDATE_CHECK_DELAY_MS);

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(checkForUpdates).toHaveBeenCalledWith({ silent: true });
  });

  it("clears timeout on unmount before delay fires", () => {
    const checkForUpdates = useUpdateStore.getState().checkForUpdates;
    const { unmount } = renderHook(() => useStartupUpdateCheck());

    unmount();

    vi.advanceTimersByTime(STARTUP_UPDATE_CHECK_DELAY_MS);

    expect(checkForUpdates).not.toHaveBeenCalled();
  });
});
