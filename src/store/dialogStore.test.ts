import { describe, it, expect, beforeEach } from "vitest";
import { useDialogStore } from "./dialogStore";

beforeEach(() => {
  useDialogStore.setState(useDialogStore.getInitialState());
});

describe("dialogStore — initial state", () => {
  it("starts with no dialog open", () => {
    const state = useDialogStore.getState();
    expect(state.openDialog).toBeNull();
    expect(state.dialogTarget).toBeNull();
    expect(state.dragCopyRequest).toBeNull();
  });
});

describe("dialogStore — setOpenDialog", () => {
  it("opens a dialog by type", () => {
    useDialogStore.getState().setOpenDialog("copy");
    expect(useDialogStore.getState().openDialog).toBe("copy");
  });

  it("can switch between dialog types", () => {
    const { setOpenDialog } = useDialogStore.getState();
    setOpenDialog("copy");
    setOpenDialog("move");
    expect(useDialogStore.getState().openDialog).toBe("move");
  });

  it("supports all dialog types", () => {
    const types = ["copy", "move", "mkdir", "newfile", "delete", "search", "preview", "info"] as const;
    for (const type of types) {
      useDialogStore.getState().setOpenDialog(type);
      expect(useDialogStore.getState().openDialog).toBe(type);
    }
  });
});

describe("dialogStore — openInfoDialog", () => {
  it("sets dialog type to info with target", () => {
    useDialogStore.getState().openInfoDialog({
      panelId: "left",
      path: "/some/file.txt",
    });

    const state = useDialogStore.getState();
    expect(state.openDialog).toBe("info");
    expect(state.dialogTarget).toEqual({
      panelId: "left",
      path: "/some/file.txt",
    });
  });
});

describe("dialogStore — closeDialog", () => {
  it("resets dialog type and target to null", () => {
    const { openInfoDialog, closeDialog } = useDialogStore.getState();

    openInfoDialog({ panelId: "right", path: "/test" });
    closeDialog();

    const state = useDialogStore.getState();
    expect(state.openDialog).toBeNull();
    expect(state.dialogTarget).toBeNull();
  });
});

describe("dialogStore — openDragCopyDialog", () => {
  it("opens copy dialog with drag payload", () => {
    useDialogStore.getState().openDragCopyDialog({
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/left/file.txt"],
      targetPath: "/right",
    });

    const state = useDialogStore.getState();
    expect(state.openDialog).toBe("copy");
    expect(state.dragCopyRequest).toEqual({
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/left/file.txt"],
      targetPath: "/right",
    });
    expect(state.isPasteMode).toBe(false);
  });

  it("clears drag payload when dialog closes", () => {
    const { openDragCopyDialog, closeDialog } = useDialogStore.getState();

    openDragCopyDialog({
      sourcePanelId: "left",
      targetPanelId: "right",
      sourcePaths: ["/left/file.txt"],
      targetPath: "/right",
    });
    closeDialog();

    expect(useDialogStore.getState().dragCopyRequest).toBeNull();
  });
});
