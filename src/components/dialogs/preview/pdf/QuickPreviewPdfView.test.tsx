import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { QuickPreviewPdfView } from "./QuickPreviewPdfView";
import type { PdfDocumentHandle, PdfRendererModule, PdfSource } from "./pdfTypes";

const makeDocument = (
  numPages: number
): PdfDocumentHandle & { destroy: Mock<() => void> } => ({
  numPages,
  getPageSize: vi.fn().mockResolvedValue({ width: 600, height: 800 }),
  renderPage: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  destroy: vi.fn<() => void>(),
});

const makeRenderer = (
  open: (source: PdfSource) => Promise<PdfDocumentHandle>
): PdfRendererModule & { openPdf: ReturnType<typeof vi.fn> } => ({
  openPdf: vi.fn((source: PdfSource) => ({ promise: open(source), cancel: vi.fn() })),
});

const renderView = (renderer: PdfRendererModule, readFileBinary = vi.fn()) =>
  render(
    <QuickPreviewPdfView
      src="asset://localhost/docs/sample.pdf"
      filePath="/docs/sample.pdf"
      loadRenderer={async () => renderer}
      readFileBinary={readFileBinary}
    />
  );

const pressKey = (key: string) => {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
};

describe("QuickPreviewPdfView", () => {
  beforeEach(() => {
    // jsdom은 캔버스를 PNG로 바꾸지 못한다. 썸네일 이미지 변환은 빈 결과로 둔다.
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(null));
  });

  it("shows page thumbnails and moves one page at a time with the keyboard", async () => {
    const document = makeDocument(3);
    renderView(makeRenderer(async () => document));

    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /페이지로 이동/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "1페이지로 이동" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    pressKey("ArrowDown");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    pressKey("End");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    pressKey("ArrowDown");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    pressKey("ArrowUp");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    pressKey("Home");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    // Space는 미리보기 닫기용이라 페이지를 넘기지 않는다.
    pressKey(" ");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.renderPage).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), expect.any(Number))
    );
  });

  it("goes to a page when its thumbnail is clicked", async () => {
    renderView(makeRenderer(async () => makeDocument(4)));

    fireEvent.click(await screen.findByRole("button", { name: "3페이지로 이동" }));

    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3페이지로 이동" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("reads the file directly when the asset URL cannot be opened", async () => {
    const document = makeDocument(2);
    const renderer = makeRenderer(async (source) => {
      if ("url" in source) {
        throw new Error("Unexpected server response (403)");
      }
      return document;
    });
    const readFileBinary = vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    renderView(renderer, readFileBinary);

    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(readFileBinary).toHaveBeenCalledWith("/docs/sample.pdf");
    expect(renderer.openPdf).toHaveBeenLastCalledWith({ data: new Uint8Array([37, 80, 68, 70]) });
  });

  it("offers the built-in viewer for password protected documents", async () => {
    const readFileBinary = vi.fn();
    const renderer = makeRenderer(async () => {
      throw Object.assign(new Error("No password given"), { name: "PasswordException" });
    });

    renderView(renderer, readFileBinary);

    expect(await screen.findByText("암호가 걸린 PDF입니다")).toBeInTheDocument();
    expect(readFileBinary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "기본 뷰어로 보기" }));
    expect(screen.getByTitle("PDF preview")).toHaveAttribute(
      "src",
      "asset://localhost/docs/sample.pdf"
    );
  });

  it("opens the document once across re-renders when using the file system facade", async () => {
    const renderer = makeRenderer(async () => makeDocument(2));
    const loadRenderer = async () => renderer;
    const view = (
      <QuickPreviewPdfView
        src="asset://localhost/docs/sample.pdf"
        filePath="/docs/sample.pdf"
        loadRenderer={loadRenderer}
      />
    );
    const { rerender } = render(view);
    await screen.findByText("1 / 2");

    rerender(view);
    pressKey("ArrowDown");

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(renderer.openPdf).toHaveBeenCalledTimes(1);
  });

  it("releases the document when the preview closes", async () => {
    const document = makeDocument(2);
    const { unmount } = renderView(makeRenderer(async () => document));
    await screen.findByText("1 / 2");

    unmount();

    expect(document.destroy).toHaveBeenCalledTimes(1);
  });
});
