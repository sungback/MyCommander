import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastViewport } from "./ToastViewport";
import { showTransientToast, useToastStore } from "../../store/toastStore";

describe("ToastViewport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState(useToastStore.getInitialState());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders toasts pushed to the store", () => {
    showTransientToast("경로를 복사했습니다.", { durationMs: 1500 });

    render(<ToastViewport />);

    expect(screen.getByText("경로를 복사했습니다.")).toBeInTheDocument();
  });

  it("removes transient toasts after the duration", () => {
    showTransientToast("복사 완료", { durationMs: 1500 });

    render(<ToastViewport />);

    expect(screen.getByText("복사 완료")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText("복사 완료")).not.toBeInTheDocument();
  });
});
