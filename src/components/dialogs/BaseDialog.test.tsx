import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "../../store/panelStore";
import { BaseDialog } from "./BaseDialog";

const Harness = ({ isOpen }: { isOpen: boolean }) => (
  <>
    <div role="listbox" data-panel-id="left" tabIndex={0} aria-label="left list" />
    <div role="listbox" data-panel-id="right" tabIndex={0} aria-label="right list" />
    <BaseDialog title="Rename" isOpen={isOpen} onClose={vi.fn()} onSubmit={vi.fn()}>
      <input aria-label="name" />
    </BaseDialog>
  </>
);

describe("BaseDialog — 닫은 뒤 포커스", () => {
  beforeEach(() => {
    usePanelStore.setState(usePanelStore.getInitialState());
    usePanelStore.getState().setActivePanel("left");
  });

  it("닫으면 활성 패널의 파일 목록으로 포커스를 돌려 준다(열기 전 포커스가 body였어도)", async () => {
    const { rerender } = render(<Harness isOpen={true} />);
    await screen.findByLabelText("name");
    expect(document.activeElement).not.toBe(screen.getByLabelText("left list"));

    rerender(<Harness isOpen={false} />);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("left list")));
  });

  it("활성 패널이 오른쪽이면 오른쪽 파일 목록으로 돌려 준다", async () => {
    usePanelStore.getState().setActivePanel("right");
    const { rerender } = render(<Harness isOpen={true} />);
    await screen.findByLabelText("name");

    rerender(<Harness isOpen={false} />);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("right list")));
  });

  it("다른 대화상자가 열려 있으면 포커스를 빼앗지 않는다", async () => {
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.appendChild(other);
    try {
      const { rerender } = render(<Harness isOpen={true} />);
      await screen.findByLabelText("name");

      rerender(<Harness isOpen={false} />);

      await waitFor(() => expect(screen.queryByLabelText("name")).toBeNull());
      expect(document.activeElement).not.toBe(screen.getByLabelText("left list"));
    } finally {
      other.remove();
    }
  });
});
