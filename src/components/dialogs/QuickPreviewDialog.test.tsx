import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogStore } from "../../store/dialogStore";
import { QuickPreviewDialog } from "./QuickPreviewDialog";

const { mockLoadPreviewForPath, mockLoadSourceHighlightHtml } = vi.hoisted(() => ({
  mockLoadPreviewForPath: vi.fn(),
  mockLoadSourceHighlightHtml: vi.fn(),
}));

vi.mock("./quickPreviewLoader", () => ({
  getFileName: (path: string) => path.split(/[\\/]/).pop() ?? path,
  loadPreviewForPath: mockLoadPreviewForPath,
  loadSourceHighlightHtml: mockLoadSourceHighlightHtml,
}));

describe("QuickPreviewDialog status messages", () => {
  beforeEach(() => {
    mockLoadPreviewForPath.mockReset();
    mockLoadSourceHighlightHtml.mockReset();
    useDialogStore.setState(useDialogStore.getInitialState());
    useDialogStore.getState().openPreviewDialog({
      panelId: "left",
      path: "/tmp/archive.bin",
    });
  });

  it("shows a consistent unsupported-file message", async () => {
    mockLoadPreviewForPath.mockResolvedValue({ type: "unsupported" });

    render(<QuickPreviewDialog />);

    expect(
      await screen.findByText("미리보기를 지원하지 않는 형식입니다")
    ).toBeInTheDocument();
    expect(
      screen.getByText("이 파일 형식은 빠른 미리보기에서 바로 열 수 없습니다.")
    ).toBeInTheDocument();
  });

  it("shows file-size errors as a size-specific preview status", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockLoadPreviewForPath.mockRejectedValue(
      new Error("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.")
    );

    render(<QuickPreviewDialog />);

    expect(await screen.findByText("파일이 너무 큽니다")).toBeInTheDocument();
    expect(
      screen.getByText("5MB를 초과한 파일은 빠른 미리보기에서 열지 않습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.")
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("keeps rendered preview source toggling available", async () => {
    mockLoadPreviewForPath.mockResolvedValue({
      type: "rendered",
      content: "# Title",
      renderedHtml: "<h1>Title</h1>",
      renderExt: "markdown",
    });
    mockLoadSourceHighlightHtml.mockResolvedValue(
      '<span class="hljs-section"># Title</span>'
    );

    render(<QuickPreviewDialog />);

    expect(await screen.findByTitle("소스 보기")).toBeInTheDocument();
    expect(screen.getByTitle("rendered preview")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("소스 보기"));

    expect(await screen.findByTitle("렌더링 보기")).toBeInTheDocument();
    expect(mockLoadSourceHighlightHtml).toHaveBeenCalledWith("# Title", "markdown");
    expect(screen.getByText("# Title")).toBeInTheDocument();
  });
});
