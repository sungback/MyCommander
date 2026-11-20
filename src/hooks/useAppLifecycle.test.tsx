import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelStore } from "../store/panelStore";
import { useAppCommandListeners } from "./useAppLifecycle";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: { payload?: unknown }) => void>(),
  toast: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload?: unknown }) => void) => {
    mocks.handlers.set(name, handler);
    return () => {
      mocks.handlers.delete(name);
    };
  }),
}));

vi.mock("../store/toastStore", () => ({ showTransientToast: mocks.toast }));

const file = (name: string) => ({
  name,
  path: `/d/${name}`,
  kind: "file" as const,
  size: 1,
});

const renderListeners = async () => {
  const openMultiRenameDialog = vi.fn();
  renderHook(() =>
    useAppCommandListeners({
      openMultiRenameDialog,
      setOpenDialog: vi.fn(),
      syncOtherPanelToCurrentPath: vi.fn(),
    })
  );
  // listen()의 Promise가 풀려 핸들러가 등록될 때까지 기다린다.
  await vi.waitFor(() => expect(mocks.handlers.has("multi-rename-requested")).toBe(true));
  return openMultiRenameDialog;
};

const emitMultiRename = () => mocks.handlers.get("multi-rename-requested")?.({});

describe("useAppCommandListeners — multi-rename-requested", () => {
  beforeEach(() => {
    mocks.handlers.clear();
    usePanelStore.setState(usePanelStore.getInitialState());
    usePanelStore.getState().setActivePanel("left");
  });

  it("대상이 있으면 일괄 이름 바꾸기 대화상자를 연다", async () => {
    usePanelStore.getState().setFiles("left", [file("a.txt")]);
    usePanelStore.getState().setCursor("left", 0);
    const openMultiRenameDialog = await renderListeners();

    emitMultiRename();

    expect(openMultiRenameDialog).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("선택이 없고 대상도 없으면 대화상자 대신 안내한다", async () => {
    usePanelStore.getState().setFiles("left", [{ name: "..", path: "/", kind: "directory" }]);
    usePanelStore.getState().setCursor("left", 0);
    const openMultiRenameDialog = await renderListeners();

    emitMultiRename();

    expect(openMultiRenameDialog).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith("이름을 바꿀 항목이 없습니다.", { tone: "error" });
  });

  it("선택이 전부 펼친 하위 항목이면 현재 폴더 항목만 가능하다고 안내한다", async () => {
    usePanelStore.getState().setFiles("left", [file("a.txt")]);
    usePanelStore.getState().setSelection("left", ["/d/sub/child.txt"]);
    usePanelStore.getState().setCursor("left", 0);
    const openMultiRenameDialog = await renderListeners();

    emitMultiRename();

    expect(openMultiRenameDialog).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      "현재 폴더의 선택 항목만 일괄 이름 바꾸기를 할 수 있습니다.",
      { tone: "error" }
    );
  });
});
