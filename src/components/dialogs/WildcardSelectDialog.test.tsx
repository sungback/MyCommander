import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WildcardSelectDialog } from "./WildcardSelectDialog";

describe("WildcardSelectDialog", () => {
  it("renders with title and default pattern in select mode", () => {
    render(
      <WildcardSelectDialog
        isOpen={true}
        mode="select"
        initialPattern="*.png"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onInvert={vi.fn()}
      />
    );

    expect(screen.getByText("패턴으로 파일 선택")).toBeInTheDocument();
    const input = screen.getByDisplayValue("*.png");
    expect(input).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택" })).toBeInTheDocument();
  });

  it("submits pattern with current mode", () => {
    const onSubmit = vi.fn();
    render(
      <WildcardSelectDialog
        isOpen={true}
        mode="select"
        initialPattern="*.txt"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onInvert={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "선택" });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith("*.txt", "select");
  });

  it("toggles mode to unselect and updates title and submitLabel", () => {
    const onSubmit = vi.fn();
    render(
      <WildcardSelectDialog
        isOpen={true}
        mode="select"
        initialPattern="*.txt"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onInvert={vi.fn()}
      />
    );

    // Click mode toggle button for "선택 해제"
    const toggleBtn = screen.getByRole("button", { name: "선택 해제 모드로 전환" });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("패턴으로 파일 선택 해제")).toBeInTheDocument();

    // Now submit button is also "선택 해제"
    const submitBtn = screen.getByRole("button", { name: "선택 해제" });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith("*.txt", "unselect");
  });

  it("clicking preset chip updates input value", () => {
    render(
      <WildcardSelectDialog
        isOpen={true}
        mode="select"
        initialPattern="*.txt"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onInvert={vi.fn()}
      />
    );

    const imageChip = screen.getByRole("button", { name: "이미지" });
    fireEvent.click(imageChip);

    expect(
      screen.getByDisplayValue("*.png; *.jpg; *.jpeg; *.gif; *.webp")
    ).toBeInTheDocument();
  });

  it("clicking invert button calls onInvert and onClose", () => {
    const onInvert = vi.fn();
    const onClose = vi.fn();
    render(
      <WildcardSelectDialog
        isOpen={true}
        mode="select"
        onClose={onClose}
        onSubmit={vi.fn()}
        onInvert={onInvert}
      />
    );

    const invertBtn = screen.getByRole("button", {
      name: "현재 선택 반전 (Invert)",
    });
    fireEvent.click(invertBtn);

    expect(onInvert).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
