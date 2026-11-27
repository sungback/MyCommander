import { describe, expect, it } from "vitest";
import { registerPanelStoreReset, usePanelStore } from "./panelStore.test-harness";

registerPanelStoreReset();

const file = (name: string) => ({ name, path: `/dir/${name}`, kind: "file" as const });
const cursorName = () => {
  const { files, cursorIndex } = usePanelStore.getState().leftPanel;
  return files[cursorIndex]?.name;
};

describe("panelStore — 목록이 갱신될 때 커서", () => {
  it("커서 위쪽에 항목이 끼어들어도 같은 항목에 머문다", () => {
    const { setFiles, setCursor } = usePanelStore.getState();
    setFiles("left", [file("a.txt"), file("b.txt"), file("c.txt")]);
    setCursor("left", 1);
    expect(cursorName()).toBe("b.txt");

    // 감시 이벤트 등으로 목록이 다시 로드되며 b.txt 위에 새 항목이 생긴 경우
    usePanelStore.getState().setFiles("left", [file("0.txt"), file("a.txt"), file("b.txt"), file("c.txt")]);

    expect(cursorName()).toBe("b.txt");
  });

  it("커서 위쪽 항목이 사라져도 같은 항목에 머문다", () => {
    const { setFiles, setCursor } = usePanelStore.getState();
    setFiles("left", [file("a.txt"), file("b.txt"), file("c.txt")]);
    setCursor("left", 2);

    usePanelStore.getState().setFiles("left", [file("b.txt"), file("c.txt")]);

    expect(cursorName()).toBe("c.txt");
  });

  it("커서 항목이 사라지면 같은 위치(범위 안)로 보정한다", () => {
    const { setFiles, setCursor } = usePanelStore.getState();
    setFiles("left", [file("a.txt"), file("b.txt"), file("c.txt")]);
    setCursor("left", 2);

    usePanelStore.getState().setFiles("left", [file("a.txt"), file("b.txt")]);

    expect(usePanelStore.getState().leftPanel.cursorIndex).toBe(1);
  });

  it("pendingCursorName이 있으면 그 이름이 우선한다", () => {
    const { setFiles, setCursor, setPath } = usePanelStore.getState();
    setFiles("left", [file("a.txt"), file("b.txt"), file("c.txt")]);
    setCursor("left", 1);

    setPath("left", "/dir", "c.txt");
    usePanelStore.getState().setFiles("left", [file("a.txt"), file("b.txt"), file("c.txt")]);

    expect(cursorName()).toBe("c.txt");
  });
});
